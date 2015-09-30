(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Vector3   = require('./vector3').Vector3;
var RayTracer = require('./rayTracer');
var Real      = require('./real');
var stream    = require('./stream');
var clip      = require('./vector3').clip;
var normalize = require('./vector3').normalize;
var cross     = require('./vector3').cross;
var add       = require('./vector3').add;
var scale     = require('./vector3').scale;
var isZero    = require('./vector3').isZero;


module.exports = function Camera(stream) {
    var params = stream( Vector3, Vector3, Real );

    var viewPosition  = params[0]
    var viewDirection = normalize(params[1]);
    if (isZero(viewDirection))
        viewDirection = Vector3(0, 0, 1);

    var viewAngle = clip(params[2], 10, 160) * (Math.PI/180);

    var up, right = normalize(cross(Vector3(0, 1, 0),
                                    viewDirection));
    if (!isZero(right))
        up = normalize(cross(viewDirection, right));
    else {
        up = Vector3(0, 0, (viewDirection[1] < 0 ? 1 : -1));
        right = normalize(cross(up, viewDirection));
    }

    return {
        eyePosition: function() { return viewPosition },
        getFrame: function(scene, image, random) {
            var raytracer = RayTracer(scene);
            var aspect = image.height / image.width;
            for (var y = 0; y < image.height; ++y)
                for (var x = 0; x < image.width; ++x) {
                    var xCoeff = ((x + random()) * 2 / image.width) - 1;
                    var yCoeff = ((y + random()) * 2 / image.height) - 1;
                    var offset = add(scale(xCoeff, right),
                                     scale(yCoeff * aspect, up));
                    var sampleDirection =
                        normalize(add(viewDirection,
                                      scale(Math.tan(viewAngle * 0.5),
                                            offset)));
                    var radiance =
                        raytracer.getRadiance(viewPosition, sampleDirection,
                                              random, null);
                    image.addToPixel(x, y, radiance);
                }
        }
    };
};

},{"./rayTracer":7,"./real":8,"./stream":11,"./vector3":14}],2:[function(require,module,exports){
module.exports.TOLERANCE = 1/1024;

},{}],3:[function(require,module,exports){
"use strict";

var Vector3   = require('./vector3').Vector3;
var Real      = require('./real');
var stream    = require('./stream');
var dot      = require('./vector3').dot;


var PPM_ID = 'P6';
var MINILIGHT_URI = 'http://www.hxa.name/minilight/';
var DISPLAY_LUMINANCE_MAX = 200;
var RGB_LUMINANCE = Vector3(0.2126, 0.7152, 0.0722);
var GAMMA_ENCODE = 0.45;

module.exports = function Image(stream) {
    var params = stream( Real, Real );

    var width  = Math.max( 1, Math.floor(params[0]) );
    var height = Math.max( 1, Math.floor(params[1]) );
    var npixels = width * height;
    var pixels = [];
    for (var i = 0; i < 3 * npixels; ++i)
        pixels.push(0);

    var makeScaler = function(iteration) {
        var divider = 1 / Math.max(iteration, 1);
        var scale = calculateToneMapping(divider);
        scale *= divider;
        return function(channel) {
            var gammaed = Math.pow(Math.max(channel * scale, 0), GAMMA_ENCODE);
            return Math.min(Math.round(gammaed * 255), 255);
        };
    };

    var calculateToneMapping = function(divider) {
        var sum_of_logs = 0;
        for (var i = 0; i < npixels; ++i) {
            var pixel = Vector3(pixels[3*i], pixels[3*i+1], pixels[3*i+2]);
            var y = divider * dot(pixel, RGB_LUMINANCE);
            sum_of_logs += Math.log(Math.max(y, 1e-4));
        }
        var log_mean_luminance = Math.exp(sum_of_logs / npixels);
        var a = 1.219 + Math.pow(DISPLAY_LUMINANCE_MAX * 0.25, 0.4);
        var b = 1.219 + Math.pow(log_mean_luminance, 0.4);
        return Math.pow(a / b, 2.5) / DISPLAY_LUMINANCE_MAX;
    };

    return {
        pixels: pixels,
        width: width,
        height: height,

        addToPixel: function(x, y, radiance) {
            if (0 <= x && x < width && 0 <= y && y < height) {
                var index = (x + ((height - 1 - y) * width)) * 3;
                pixels[index+0] += radiance[0];
                pixels[index+1] += radiance[1];
                pixels[index+2] += radiance[2];
            }
        },

        save: function(iteration) {
            var scaler = makeScaler(iteration);
            var out = '';
            out += PPM_ID;
            out += '\n# ' + MINILIGHT_URI + '\n\n';
            out += '' + width + ' ' + height + '\n255\n';
            for (var i = 0; i < pixels.length; ++i)
                out += String.fromCharCode(scaler(pixels[i]));
            return out;
        },

        blit: function(imageData, iteration) {
            if (imageData.width !== width || imageData.height !== height)
                throw "Canvas dimensions mismatch";
            var scaler = makeScaler(iteration);
            var p = 0;
            for (var i = 0; i < pixels.length; i += 3) {
                imageData.data[p++] = scaler(pixels[i]);
                imageData.data[p++] = scaler(pixels[i+1]);
                imageData.data[p++] = scaler(pixels[i+2]);
                imageData.data[p++] = 0xFF;
            }
        },
    };
};

},{"./real":8,"./stream":11,"./vector3":14}],4:[function(require,module,exports){
"use strict";


var streamer  = require('./stream');
var Image     = require('./image');
var Camera    = require('./camera');
var Real      = require('./real');
var Scene     = require('./scene');
var minilight = require('./minilight');
var randomGenerator = require('./random');

var model = "#MiniLight\r\n\r\n100\r\n\r\n391 391\r\n\r\n(0.278 0.275 -0.789) (0 0 1) 40\r\n\r\n\r\n(8068 9060 12872) (0.1 0.09 0.07)\r\n\r\n\r\n(0.556 0.000 0.000) (0.006 0.000 0.559) (0.556 0.000 0.559)  (0.7 0.7 0.7) (0 0 0)\r\n(0.006 0.000 0.559) (0.556 0.000 0.000) (0.003 0.000 0.000)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.556 0.000 0.559) (0.000 0.549 0.559) (0.556 0.549 0.559)  (0.7 0.7 0.7) (0 0 0)\r\n(0.000 0.549 0.559) (0.556 0.000 0.559) (0.006 0.000 0.559)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.006 0.000 0.559) (0.000 0.549 0.000) (0.000 0.549 0.559)  (0.7 0.2 0.2) (0 0 0)\r\n(0.000 0.549 0.000) (0.006 0.000 0.559) (0.003 0.000 0.000)  (0.7 0.2 0.2) (0 0 0)\r\n\r\n(0.556 0.000 0.000) (0.556 0.549 0.559) (0.556 0.549 0.000)  (0.2 0.7 0.2) (0 0 0)\r\n(0.556 0.549 0.559) (0.556 0.000 0.000) (0.556 0.000 0.559)  (0.2 0.7 0.2) (0 0 0)\r\n\r\n\r\n(0.474 0.165 0.225) (0.426 0.165 0.065) (0.316 0.165 0.272)  (0.7 0.7 0.7) (0 0 0)\r\n(0.266 0.165 0.114) (0.316 0.165 0.272) (0.426 0.165 0.065)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.266 0.000 0.114) (0.266 0.165 0.114) (0.316 0.165 0.272)  (0.7 0.7 0.7) (0 0 0)\r\n(0.316 0.000 0.272) (0.266 0.000 0.114) (0.316 0.165 0.272)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.316 0.000 0.272) (0.316 0.165 0.272) (0.474 0.165 0.225)  (0.7 0.7 0.7) (0 0 0)\r\n(0.474 0.165 0.225) (0.316 0.000 0.272) (0.474 0.000 0.225)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.474 0.000 0.225) (0.474 0.165 0.225) (0.426 0.165 0.065)  (0.7 0.7 0.7) (0 0 0)\r\n(0.426 0.165 0.065) (0.426 0.000 0.065) (0.474 0.000 0.225)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.426 0.000 0.065) (0.426 0.165 0.065) (0.266 0.165 0.114)  (0.7 0.7 0.7) (0 0 0)\r\n(0.266 0.165 0.114) (0.266 0.000 0.114) (0.426 0.000 0.065)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n\r\n(0.133 0.330 0.247) (0.291 0.330 0.296) (0.242 0.330 0.456)  (0.7 0.7 0.7) (0 0 0)\r\n(0.242 0.330 0.456) (0.084 0.330 0.406) (0.133 0.330 0.247)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.133 0.000 0.247) (0.133 0.330 0.247) (0.084 0.330 0.406)  (0.7 0.7 0.7) (0 0 0)\r\n(0.084 0.330 0.406) (0.084 0.000 0.406) (0.133 0.000 0.247)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.084 0.000 0.406) (0.084 0.330 0.406) (0.242 0.330 0.456)  (0.7 0.7 0.7) (0 0 0)\r\n(0.242 0.330 0.456) (0.242 0.000 0.456) (0.084 0.000 0.406)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.242 0.000 0.456) (0.242 0.330 0.456) (0.291 0.330 0.296)  (0.7 0.7 0.7) (0 0 0)\r\n(0.291 0.330 0.296) (0.291 0.000 0.296) (0.242 0.000 0.456)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n(0.291 0.000 0.296) (0.291 0.330 0.296) (0.133 0.330 0.247)  (0.7 0.7 0.7) (0 0 0)\r\n(0.133 0.330 0.247) (0.133 0.000 0.247) (0.291 0.000 0.296)  (0.7 0.7 0.7) (0 0 0)\r\n\r\n\r\n(14960000000 149600000000 29920000000) (16194000000 149600000000 29920000000) (14960000000 149600000000 31154000000)  (0 0 0) (1177902548 993796380 828301072)\r\n(14960000000 149600000000 31154000000) (16194000000 149600000000 29920000000) (16194000000 149600000000 31154000000)  (0 0 0) (1177902548 993796380 828301072)\r\n";
var MODEL_FORMAT_ID = "#MiniLight";

try
{
  var stream = streamer(model, MODEL_FORMAT_ID);

  var iterations = Math.floor(stream(Real)[0]);
  var image = Image(stream);
  var camera = Camera(stream);

  var scene = Scene(stream, camera.eyePosition());

  minilight(image, iterations, camera, scene, randomGenerator());
  var pgm = image.save(iterations);

  document.getElementById('model-data').innerHTML = model;

  var theview = document.getElementById('theview');
  theview.setAttribute( 'width',  image.width  );
  theview.setAttribute( 'height', image.height );
  var ctx = theview.getContext('2d');
  var imgdata = ctx.getImageData(0, 0, theview.width, theview.height);
  image.blit(imgdata, iterations);
  ctx.putImageData(imgdata, 0, 0);
}
catch( e )
{
  alert( e.name + " -- " + e.message );
}

},{"./camera":1,"./image":3,"./minilight":5,"./random":6,"./real":8,"./scene":9,"./stream":11}],5:[function(require,module,exports){
"use strict";

// TODO: break up calculation into timeslices or use webworkers
module.exports = function minilight(image, iterations, camera, scene, random) {
    for (var frameNum = 1; frameNum <= iterations; ++frameNum) {
      console.log('iteration:', frameNum);
      camera.getFrame(scene, image, random);
    }
    return image;
};

},{}],6:[function(require,module,exports){
/**
 * A random number generator producing reals [0,1).
 *
 * A simple, fast, good random number generator (Multiply-with-carry).
 * Perhaps the fastest of any generator that passes the Diehard tests (assuming
 * a low-level implementation like C or ASM).
 *
 * ( [0,1) means a range of 0 to just less than 1 )
 *
 * @implementation
 * Concatenation of following two 16-bit multiply-with-carry generators
 * x(n)=a*x(n-1)+carry mod 2^16 and y(n)=b*y(n-1)+carry mod 2^16, number and
 * carry packed within the same 32 bit integer. Algorithm recommended by
 * Marsaglia.
 * Translated from C implementation by Glenn Rhoads, 2005.
 * http://web.archive.org/web/20050213041650/http://
 * paul.rutgers.edu/~rhoads/Code/code.html
 */

"use strict";

/**
 * Make a random generator (32 bit precision version).
 *
 * @param  seed [integer|falsy] positive < 2^32, or zero or falsy for default
 * @return [function[-> real[0-1]]] generator
 */
module.exports = function( seed )
{
   // condition param to 32 bit unsigned integer
   seed = !seed ? 0 : Math.floor(Math.abs(seed)) % 4294967296;

   // init seed state
   // (invariant: both integers >= 0 and < 2^32)
   var seed0 = (0 === seed) ? 521288629 : seed;
   var seed1 = (0 === seed) ? 362436069 : seed;

   // make generator
   return function()
   {
      // use any pair of non-equal numbers from this list for the two
      // constants:
      // 18000 18030 18273 18513 18879 19074 19098 19164 19215 19584
      // 19599 19950 20088 20508 20544 20664 20814 20970 21153 21243
      // 21423 21723 21954 22125 22188 22293 22860 22938 22965 22974
      // 23109 23124 23163 23208 23508 23520 23553 23658 23865 24114
      // 24219 24660 24699 24864 24948 25023 25308 25443 26004 26088
      // 26154 26550 26679 26838 27183 27258 27753 27795 27810 27834
      // 27960 28320 28380 28689 28710 28794 28854 28959 28980 29013
      // 29379 29889 30135 30345 30459 30714 30903 30963 31059 31083

      // update seed state
      seed0 = (18000 * (seed0 % 65536)) + Math.floor(seed0 / 65536);
      seed1 = (30903 * (seed1 % 65536)) + Math.floor(seed1 / 65536);

      // make [0,1) real with 32 bit precision
      var uint32 = ((seed0 * 65536) % 4294967296) + (seed1 % 65536);
      return uint32 / 4294967296;
   };
};

},{}],7:[function(require,module,exports){
// Ray tracer for general light transport.

// Traces a path with emitter sampling: A single chain of ray-steps advances
// from the eye into the scene with one sampling of emitters at each node.

"use strict";

var SurfacePoint = require('./surfacepoint');
var sub          = require('./vector3').sub;
var mul          = require('./vector3').mul;
var scale        = require('./vector3').scale;
var neg          = require('./vector3').neg;
var ZERO         = require('./vector3').ZERO;
var add          = require('./vector3').add;
var normalize    = require('./vector3').normalize;


module.exports = function RayTracer(scene) {

    // Return eyeward radiance. lastHit is a triangle or null.
    function getRadiance(rayOrigin, rayDirection, random, lastHit) {
        var tmp = scene.intersect(rayOrigin, rayDirection, lastHit);
        if (tmp === null)
            return scene.getDefaultEmission(neg(rayDirection));
        var surfacePoint = SurfacePoint(tmp[0], tmp[1]);
        var localEmission = 
            lastHit ? ZERO : surfacePoint.getEmission(rayOrigin, 
                                                      neg(rayDirection),
                                                      false);
        var illumination = sampleEmitters(rayDirection, surfacePoint, random);
        var reflection = ZERO;
        tmp = surfacePoint.getNextDirection(random, neg(rayDirection));
        if (tmp) {
            var nextDirection = tmp[0], color = tmp[1];
            reflection = mul(color, getRadiance(surfacePoint.position,
                                                nextDirection,
                                                random,
                                                surfacePoint.triangle));
        }
        return add(localEmission, add(reflection, illumination));
    }

    // Return radiance from an emitter sample
    function sampleEmitters(rayDirection, surfacePoint, random) {
        var emitter = scene.sampleEmitter(random);
        if (!emitter) return ZERO;
        var position = emitter.samplePoint(random);
        var direction = normalize(sub(position, surfacePoint.position));
        // Does the ray from surfacePoint to position see it, unoccluded?
        var hit = scene.intersect(surfacePoint.position, direction,
                                  surfacePoint.triangle);
        if (hit && hit[0] !== emitter)
            return ZERO;        // No, it's occluded.
        var emissionIn =
            SurfacePoint(emitter, position).getEmission(surfacePoint.position,
                                                        neg(direction),
                                                        true);
        return surfacePoint.getReflection(direction,
                                          scale(scene.countEmitters(), emissionIn),
                                          neg(rayDirection));
    }

    return {
        getRadiance: getRadiance,
    };
};

},{"./surfacepoint":12,"./vector3":14}],8:[function(require,module,exports){
var Real = function( str ) { return parseFloat(str); };
Real.regex = "(\\S+)";

module.exports = Real;

},{}],9:[function(require,module,exports){
"use strict";

var SpatialIndex = require('./spatialindex');
var Triangle     = require('./triangle');
var Vector3      = require('./vector3').Vector3;
var mul          = require('./vector3').mul;
var clamp        = require('./vector3').clamp;
var isZero       = require('./vector3').isZero;


// Maximum number of objects in Scene.
// (2^24 ~= 16 million)
var TRIANGLES_MAX = 0x1000000;

module.exports = function Scene(stream, eyePosition) {
    var params = stream( Vector3, Vector3 );

    var skyEmission = clamp(params[0], 0, Infinity);
    var groundReflection = mul(skyEmission, clamp(params[1], 0, 1));
    var triangles = [];
    for( var i = 0;  i < TRIANGLES_MAX;  ++i )
    {
        try { triangles.push( Triangle(stream) ); }
        // at EOF, just stop reading
        catch( e ) { if( e.name !== "ExceptionModelEOF" ) throw e; else break; }
    }
    var emitters = filter(triangles, glows);
    var index = SpatialIndex(eyePosition, triangles);
    return {
        intersect: function(rayOrigin, rayDirection, lastHit) {
            return index.intersection(rayOrigin, rayDirection, lastHit);
        },
        sampleEmitter: function(random) {
            if (emitters.length === 0) return null;
            return sampleArray(emitters, random);
        },
        countEmitters: function() {
            return emitters.length;
        },
        getDefaultEmission: function(backDirection) {
            return backDirection[1] < 0 ? skyEmission : groundReflection;
        },
    };
};

function glows(triangle) {
    return !isZero(triangle.emissivity) && 0 < triangle.getArea();
}

function filter(xs, ok) {
    var result = [];
    for (var i = 0; i < xs.length; ++i)
        if (ok(xs[i]))
            result.push(xs[i]);
    return result;
}

function sampleArray(xs, random) {
    return xs[Math.floor(random() * xs.length)];
}

},{"./spatialindex":10,"./triangle":13,"./vector3":14}],10:[function(require,module,exports){
/**
 * Minimal spatial index for ray tracing.
 *
 * Suitable for a scale of 1 numerical unit == 1 metre, and with a resolution
 * of 1 millimetre. (Implementation uses fixed tolerances)
 *
 * Constant.
 *
 * @implementation
 * A crude State pattern: typed by isBranch field to be either a branch
 * or leaf cell.
 *
 * Octree: axis-aligned, cubical. Subcells are numbered thusly:
 *            110---111
 *            /|    /|
 *         010---011 |
 *    y z   | 100-|-101
 *    |/    |/    | /
 *    .-x  000---001
 *
 * Each cell stores its bound (fatter data, but simpler code).
 *
 * Calculations for building and tracing are absolute rather than incremental --
 * so quite numerically solid. Uses tolerances in: bounding triangles (in
 * Triangle.bound), and checking intersection is inside cell (both effective
 * for axis-aligned items). Also, depth is constrained to an absolute subcell
 * size (easy way to handle overlapping items).
 *
 * @invariants
 * * bound is an Object of two Vector3
 *   * bound.lower <= bound.upper
 *   * bound encompasses the cell's contents
 * * isBranch is a Boolean
 * * subParts is:
 *    if isBranch
 *       an Array, length == 8, elements are SpatialIndex or null
 *    else
 *       an Array, elements are Triangle
 */

"use strict";

var Vector3 = require('./vector3').Vector3;
var add = require('./vector3').add;
var sub = require('./vector3').sub;
var scale = require('./vector3').scale;
var neg = require('./vector3').neg;
var clamp = require('./vector3').clamp;
var TOLERANCE = require('./constants').TOLERANCE;


/**
 * Construct a SpatialIndex.
 *
 * Construct basic object and prepare to set fields, before delegating to
 * main internal constructor.
 *
 * overloaded params:
 * public:
 * @param  eyePosition [Vector3]         position of eye point
 * @param  items       [Array[Triangle]] items to be indexed
 * private:
 * @param  bound       [Object[Vector3,Vector3]] lower and upper corners
 * @param  items       [Array[Triangle]]         items to be indexed
 * @param  level       [integer]                 depth in the tree
 *
 * @return [SpatialIndex]
 */
var SpatialIndex =
   function()
{
   if( this === (function(){return this;}).call() )
      return new SpatialIndex( arguments[0], arguments[1], arguments[2] );

   var items = arguments[1];

   // public construction, with: eyePosition, items
   if( arguments[2] === undefined )
   {
      var eyePosition = arguments[0];

      // make rectilinear bound
      {
         // include eye position -- simplifies intersection algorithm
         var rectBound = { lower: eyePosition, upper: eyePosition };
         // accommodate all items
         for( var i = items.length, rb = rectBound;  i-- > 0; )
         {
            // expand to fit item
            var ib = items[i].bound();
            rb.lower = clamp( rb.lower, -Infinity, ib.lower );
            rb.upper = clamp( rb.upper, ib.upper,  Infinity );
         }
      }

      // make cubical upper bound
      {
         // find max dimension
         var maxSize = Math.max.apply( null,
            sub( rectBound.upper, rectBound.lower ));
         // set all dimensions to max
         var cubeUpper = add( rectBound.lower, Vector3(maxSize) );
         // prevent any numerical slippage
         cubeUpper = clamp( cubeUpper, rectBound.upper, cubeUpper );
      }

      // make cubical bound
      var bound = { lower: rectBound.lower, upper: cubeUpper };
      var level = 0;
   }
   // private construction, with: bound, items, level
   else
   {
      var bound = arguments[0];
      var level = arguments[2];
   }

   // make subcell tree, with main (recursive) constructor
   this.construct_( bound, items, level );
};




/// queries --------------------------------------------------------------------

/**
 * Find nearest intersection of ray with item.
 *
 * @query
 *
 * @param  rayOrigin    [Vector3]  ray start point
 * @param  rayDirection [Vector3]  ray direction (unitized)
 * @param  lastHit      [Triangle] previous item intersected
 *
 * @return [Array[Triangle,Vector3]|null] hit object and position, or null
 */
SpatialIndex.prototype.intersection =
   function( rayOrigin, rayDirection, lastHit )
{
   // (fake polymorphism for the State pattern)
   return this.isBranch ?
      this.intersectBranch_( rayOrigin, rayDirection, lastHit, arguments[3] ) :
      this.intersectLeaf_( rayOrigin, rayDirection, lastHit );
};




/// implementation /////////////////////////////////////////////////////////////

/// constants

// accommodates scene including sun and earth, down to cm cells (use 47 for mm)
SpatialIndex.MAX_LEVELS_ = 44;

// 8 seemed reasonably optimal in casual testing
SpatialIndex.MAX_ITEMS_  =  8;


/**
 * Main recursive constructor.
 *
 * Set all object fields: isBranch, bound, subParts.
 *
 * @command
 *
 * @param  bound [Object[Vector3,Vector3]] lower and upper corners
 * @param  items [Array[Triangle]]         items remaining to insert
 * @param  level [integer]                 depth in the tree
 */
SpatialIndex.prototype.construct_ =
   function( bound, items, level )
{
   this.bound = bound;

   // is branch if items overflow leaf and tree not too deep
   this.isBranch = (items.length > SpatialIndex.MAX_ITEMS_) &&
      (level < (SpatialIndex.MAX_LEVELS_ - 1));

   // make branch: make subcells, and recurse construction
   if( this.isBranch )
   {
      // make subcells
      this.subParts = new Array( 8 );
      for( var s = 0, q = 0;  s < this.subParts.length;  ++s )
      {
         // make subcell bound
         var subBound = { lower: Vector3(0), upper: Vector3(0) };
         for( var b = 0, c = (s & 1);  b < 3;  ++b, c = (s >> b) & 1 )
         {
            var mid = (this.bound.lower[b] + this.bound.upper[b]) * 0.5;
            subBound.lower[b] = c ? mid : this.bound.lower[b];
            subBound.upper[b] = c ? this.bound.upper[b] : mid;
         }

         // collect items that overlap subcell
         var subItems = [];
         for( var i = 0;  i < items.length;  ++i )
         {
            // must overlap in all dimensions
            var itemBound = items[i].bound();
            for( var b = 0, isOverlap = true;  b < 3;  ++b )
            {
               isOverlap &= (itemBound.upper[b] >= subBound.lower[b]) &&
                  (itemBound.lower[b] < subBound.upper[b]);
            }

            if( isOverlap ) subItems.push( items[i] );
         }

         // decide next level, curtailing degenerate subdivision
         // (setting next level to max will make next recursion end)
         // (degenerate if two or more subcells copy entire contents of parent,
         // or if subdivision reaches below mm size)
         // (having a model including the sun requires one subcell copying
         // entire contents of parent to be allowed)
         if( subItems.length === items.length ) ++q;
         var subLevel = ((q > 1) || ((subBound.upper[0] - subBound.lower[0]) <
            (TOLERANCE * 4))) ? SpatialIndex.MAX_LEVELS_ : level + 1;

         // recurse, if any overlapping subitems
         this.subParts[s] = subItems.length ?
            SpatialIndex( subBound, subItems, subLevel ) : null;
      }
   }
   // make leaf: store items, and end recursion
   else
   {
      this.subParts = items;
   }
};


/**
 * Find nearest intersection of ray with branch.
 *
 * @query
 *
 * @param  rayOrigin    [Vector3]       ray start point
 * @param  rayDirection [Vector3]       ray direction (unitized)
 * @param  lastHit      [Triangle]      previous item intersected
 * @param  cellPosition [Vector3|falsy] walk-point, or falsy
 *
 * @return [Array[Triangle,Vector3]|null] hit object and position, or null
 */
SpatialIndex.prototype.intersectBranch_ =
   function( rayOrigin, rayDirection, lastHit, cellPosition )
{
   var midPoint = scale( 0.5, add( this.bound.lower, this.bound.upper ) );

   // first call has no walk-point
   cellPosition = cellPosition || rayOrigin;

   // find which subcell holds walk-point
   var subCell = 0;
   for( var i = 3;  i--;  subCell |= ((cellPosition[i] >= midPoint[i]) << i) );

   // walk, along ray, through intersected subcells
   // (cellPosition and subCell are the iterators)
   while( true )
   {
      // maybe recurse into subcell, and maybe exit branch if item was hit
      if( this.subParts[subCell] )
      {
         var hit = this.subParts[subCell].intersection(
            rayOrigin, rayDirection, lastHit, cellPosition );

         if( hit ) return hit;
      }

      // find next subcell ray moves to
      // (find which face of corner ahead is crossed first)
      var axis = 2;
      var step = new Array( 3 );
      for( var i = 3;  i-- > 0;  axis = (step[i] < step[axis]) ? i : axis )
      {
         // find which face (inter-/outer-) the ray is heading for (in this
         // dimension)
         var high = (subCell >> i) & 1;
         var face = (rayDirection[i] < 0) ^ high ?
            this.bound[high ? 'upper' : 'lower'][i] : midPoint[i];
         // calculate distance to face
         // (div by zero produces infinity, which is later discarded)
         step[i] = (face - rayOrigin[i]) / rayDirection[i];
         // last clause of for-statement notes nearest so far
      }

      // leaving branch if: direction is negative and subcell is low,
      // or direction is positive and subcell is high
      if( ((subCell >> axis) & 1) ^ (rayDirection[axis] < 0) ) return null;

      // move to (outer face of) next subcell
      cellPosition = add( rayOrigin, scale( step[axis], rayDirection ) );
      subCell      = subCell ^ (1 << axis);
   }
};


/**
 * Find nearest intersection of ray with leaf.
 *
 * @query
 *
 * @param  rayOrigin    [Vector3]  ray start point
 * @param  rayDirection [Vector3]  ray direction (unitized)
 * @param  lastHit      [Triangle] previous item intersected
 *
 * @return [Array[Triangle,Vector3]|null] hit object and position, or null
 */
SpatialIndex.prototype.intersectLeaf_ =
   function( rayOrigin, rayDirection, lastHit )
{
   // results
   var hitObject   = null;
   var hitPosition = null;

   var boundLow = this.bound.lower;
   var boundUpp = this.bound.upper;

   // test all items in leaf
   for( var i = this.subParts.length, nearest = Number.MAX_VALUE;  i-- > 0; )
   //for( item in this.subParts )   // better ?
   {
      var item = this.subParts[i];

      // avoid spurious intersection with surface just come from
      if( item !== lastHit )
      {
         // intersect ray with item, and inspect if nearest so far
         var distance = item.intersection( rayOrigin, rayDirection );
         if( distance && (distance < nearest) )
         {
            // check intersection is inside cell bound (with tolerance)
            var hit = add(rayOrigin, scale(distance, rayDirection));
            var t   = TOLERANCE;
            if( (boundLow[0] - hit[0] <= t) && (hit[0] - boundUpp[0] <= t) &&
                (boundLow[1] - hit[1] <= t) && (hit[1] - boundUpp[1] <= t) &&
                (boundLow[2] - hit[2] <= t) && (hit[2] - boundUpp[2] <= t) )
            {
               // note nearest so far
               hitObject   = item;
               hitPosition = hit;
               nearest     = distance;
            }
         }
      }
   }

   // check there was a hit
   return hitObject ? [ hitObject, hitPosition ] : null;
};

module.exports = SpatialIndex;

},{"./constants":2,"./vector3":14}],11:[function(require,module,exports){
"use strict";

/**
 * Make a string-line-streamer-parser; read the next line into a set of values.
 *
 * @param  str [String] content
 * @param  id  [String] format ID to check
 * @return [function[constructor, ... -> [value, ...]]] streamer, takes a set of
 *         constructor params, and returns an array of values.
 *         throws ErrorModelFormat for invalid content text, and
 *         ExceptionModelEOF at end of content text.
 */
module.exports = function( str, id )
{
   // split into lines (constant), and init index (mutable)
   var lines = str.match( /^.*$/mg );
   var index = 0;

   // check format ID
   if( lines[index] !== id )
      throw { name:"ErrorModelFormat", message:"unrecognised model format" };

   // make streamer
   return function()
   {
      // get next non-blank line
      for( ;  (++index < lines.length) && lines[index].match(/^\s*$/); ) {};

      // extract values from line
      var line = lines[index];
      if( line !== undefined )
      {
         // make parsing pattern for whole line
         for( var regexs = [], i = arguments.length;  i--; )
            regexs[i] = arguments[i].regex;

         // parse each part
         var parts = line.match( "^\\s*" + regexs.join("\\s*") + "\\s*$" );
         if( parts )
         {
            // translate text segments into values
            for( var vals = [], i =  arguments.length;  i--; )
               vals[i] = arguments[i](parts[i + 1]);

            // check all succeeded
            if( vals.join().indexOf("NaN") === -1 ) return vals;
         }

         // some parsing failed earlier
         throw { name:    "ErrorModelFormat",
                 message: "model file format error in line: " + index };
      }

      // ran out of lines
      throw { name:    "ExceptionModelEOF",
              message: "model file format error: ended too early" };
   };
};

},{}],12:[function(require,module,exports){
"use strict";

var Vector3 = require('./vector3').Vector3;
var add     = require('./vector3').add;
var sub     = require('./vector3').sub;
var mul     = require('./vector3').mul;
var scale   = require('./vector3').scale;
var neg     = require('./vector3').neg;
var isZero  = require('./vector3').isZero;
var dot     = require('./vector3').dot;
var ZERO    = require('./vector3').ZERO;
var cross   = require('./vector3').cross;


// A surface point at a ray-object intersection.
// All direction parameters are unit vectors away from the surface.
function SurfacePoint(triangle, position) {
    return {
        triangle: triangle,
        position: position,

        // XXX improve comment
        // Return the vector of emission values from the surface to
        // toPosition. The unit vector outDirection is the main
        // direction of the emission and the boolean isSolidAngle
        // determines whether the emission is scaled by distance.
        getEmission: function(toPosition, outDirection, isSolidAngle) {
            var cosArea = (dot(outDirection, triangle.getNormal())
                           * triangle.getArea());
            if (cosArea <= 0)
                return ZERO;   // Emit from front face of surface only
            var ray = sub(toPosition, position);
            var distance2 = dot(ray, ray);
            var solidAngle =
                isSolidAngle ? cosArea / Math.max(distance2, 1e-6) : 1;
            return scale(solidAngle, triangle.emissivity);
        },

        // Return the reflected radiance resulting from inRadiance
        // scattering off the surface from -inDirection to outDirection.
        getReflection: function(inDirection, inRadiance, outDirection) {
            var normal = triangle.getNormal();
            var inDot  = dot(inDirection, normal);
            var outDot = dot(outDirection, normal);
            // Directions must be on same side of surface (no transmission)
            if ((inDot < 0) !== (outDot < 0))
                return ZERO;
            // Ideal diffuse BRDF:
            // radiance scaled by reflectivity, cosine, and 1/pi
            return mul(scale(Math.abs(inDot) / Math.PI, inRadiance),
                       triangle.reflectivity);
        },

        // Return the next direction and color vectors of a ray from
        // -inDirection bouncing off the surface, or null. (Monte carlo.)
        getNextDirection: function(random, inDirection) {
            var reflectivityMean = dot(triangle.reflectivity, ONE_THIRD);

            // Russian roulette for reflectance magnitude
            if (reflectivityMean <= random())
                return null;

            // Cosine-weighted importance sample hemisphere
            var _2pr1 = (2*Math.PI) * random();
            var sr2   = Math.sqrt(random());
            // Make coord frame coefficients (z in normal direction)
            var x = Math.cos(_2pr1) * sr2;
            var y = Math.sin(_2pr1) * sr2;
            var z = Math.sqrt(1 - sr2 * sr2);

            // Make coord frame
            var tangent = triangle.getTangent();
            var normal  = triangle.getNormal();
            // Put normal on inward-ray side of surface (preventing transmission)
            if (dot(normal, inDirection) < 0)
                normal = neg(normal);

            // Make vector from frame scaled by coefficients
            var outDirection = add(scale(x, tangent),
                add(scale(y, cross(normal, tangent)), scale(z, normal)));
            if (isZero(outDirection))
                return null;
            var color = scale(1 / reflectivityMean, triangle.reflectivity);
            return [outDirection, color];
        },
    };
}

var ONE_THIRD = Vector3(1/3);

module.exports = SurfacePoint;

},{"./vector3":14}],13:[function(require,module,exports){
"use strict";

var Vector3   = require('./vector3').Vector3;
var add       = require('./vector3').add;
var clamp     = require('./vector3').clamp;
var sub       = require('./vector3').sub;
var scale     = require('./vector3').scale;
var dot       = require('./vector3').dot;
var normalize = require('./vector3').normalize;
var norm      = require('./vector3').norm;
var cross     = require('./vector3').cross;
var TOLERANCE = require('./constants').TOLERANCE;


var EPSILON = 1/1048576;

var Triangle = function(stream) {
    if( this === (function(){return this;}).call() )
        return new Triangle(stream);

    var params = stream( Vector3, Vector3, Vector3, Vector3, Vector3 );

    this.vertexs = [params[0], params[1], params[2]];
    this.reflectivity = clamp(params[3], 0, 1);
    this.emissivity = clamp(params[4], 0, Infinity);
    this.edge0 = sub(this.vertexs[1], this.vertexs[0]);
    this.edge1 = sub(this.vertexs[2], this.vertexs[1]);
    this.edge2 = sub(this.vertexs[2], this.vertexs[0]);
};

Triangle.prototype.bound = function() {
    // calculate min and max across all vertexs
    var v = this.vertexs;
    var lower = clamp( clamp( v[0], -Infinity, v[1] ), -Infinity, v[2] );
    var upper = clamp( clamp( v[0], v[1],  Infinity ), v[2],  Infinity );

    // enlarge with some padding (for double precision FP)
    return { lower: sub(lower, Vector3(TOLERANCE)),
             upper: add(upper, Vector3(TOLERANCE)) };
};

// Return a positive number d such that rayOrigin + d * rayDirection
// lies within this triangle, if possible, else null.
Triangle.prototype.intersection = function(rayOrigin, rayDirection) {
    // NB This returns a number or null; the original returns a boolean
    //  along with an output parameter.
    var pvec = cross(rayDirection, this.edge2);
    var det = dot(this.edge0, pvec);
    if (-EPSILON < det && det < EPSILON)
        return null;
    var invDet = 1 / det;
    var tvec = sub(rayOrigin, this.vertexs[0]);
    var u = dot(tvec, pvec) * invDet;
    if (u < 0 || 1 < u)
        return null;
    var qvec = cross(tvec, this.edge0);
    var v = dot(rayDirection, qvec) * invDet;
    if (v < 0 || 1 < u + v)
        return null;
    var hitDistance = dot(this.edge2, qvec) * invDet;
    return 0 <= hitDistance ? hitDistance : null;
};

Triangle.prototype.samplePoint = function(random) {
    var sqr1 = Math.sqrt(random());
    var r2 = random();
    return add(scale(1 - sqr1, this.edge0),
               add(scale((1 - r2) * sqr1, this.edge2),
                   this.vertexs[0]));
};

Triangle.prototype.getNormal = function() {
    return normalize(cross(this.edge0, this.edge1));
};

Triangle.prototype.getTangent = function() {
    return normalize(this.edge0);
};

Triangle.prototype.getArea = function() {
    return 0.5 * norm(cross(this.edge0, this.edge1));
};


module.exports = Triangle;


// Tests from Clojure port

// load('vector3.js')

// Triangle in xy-plane, reflect 1/2, emit 1
//var xytriangle = Triangle([0,0,0], [1,0,0], [0,1,0], [1/2,1/2,1/2], [1,1,1])

// Same in yz plane
/// var y2ztriangle = Triangle([0,0,0], [0,2,0], [0,0,1], [1/2,1/2,1/2], [1,1,1])

// Parallel to zx plane
/// var zxtriangle = Triangle([-10,5,-10], [-9,5,-10], [-10,5,-9], [1/2,1/2,1/2], [1,1,1])

/// xytriangle.getTangent()
//. 1,0,0
/// y2ztriangle.getTangent()
//. 0,1,0

/// xytriangle.getNormal()
//. 0,0,1
/// y2ztriangle.getNormal()  // XXX different in Clojure -- don't bother to normalize?
//. 1,0,0

/// xytriangle.getArea()
//. 0.5
/// y2ztriangle.getArea()
//. 1

/// y2ztriangle.getBounds()
//. -0.0009765625,-0.0009765625,-0.0009765625,0.0009765625,2.0029296875,1.001953125
/// [TOLERANCE, 2+3*TOLERANCE, 1+2*TOLERANCE]
//. 0.0009765625,2.0029296875,1.001953125

/// xytriangle.intersect([0,0,1], [0,0,-1])
//. 1
/// xytriangle.intersect([0,0,2], [0,0,-1])
//. 2
/// xytriangle.intersect([.9,0,1], [0,0,-1])
//. 1
/// xytriangle.intersect([.1,.1,-1], [0,0,1])
//. 1

/// xytriangle.intersect([0,0,1], [0,0,1])   // Dir. is opposite
//. null
/// xytriangle.intersect([0,0,1.1], [1,0,0]) // Dir. is parallel
//. null
/// xytriangle.intersect([0,0,2], [0,1,-1])  // Goes wide
//. null

// (Just for testing.)
function checkRandomRay(t) {
    var rd = t.getNormal();
    return t.intersect(sub(t.samplePoint(Math.random), rd), rd);
}

/// checkRandomRay(xytriangle)
//. 1
/// checkRandomRay(zxtriangle)
//. 1

},{"./constants":2,"./vector3":14}],14:[function(require,module,exports){
"use strict";

function Vector3(x, y, z) {
    if( typeof x === "string" )
    {
        // three reals, spaced, parenthised: "(0.0e+0 0.0e+0 0.0e+0)"
        var a = x.match( /^\(\s*(\S+)\s*(\S+)\s*(\S+)\s*\)$/ ) || []
        return [parseFloat(a[1]), parseFloat(a[2]), parseFloat(a[3])];
    }
    else if( arguments.length >= 3 ) return [x, y, z];
    else return [(x || 0), (x || 0), (x || 0)];
}

Vector3.regex = "(\\(.+\\))";

function add(u, v) {
    return [u[0] + v[0],
            u[1] + v[1],
            u[2] + v[2]];
}

function sub(u, v) {
    return [u[0] - v[0],
            u[1] - v[1],
            u[2] - v[2]];
}

function mul(u, v) {
    return [u[0] * v[0],
            u[1] * v[1],
            u[2] * v[2]];
}

function scale(c, v) {
    return [c * v[0],
            c * v[1],
            c * v[2]];
}

function neg(v) {
    return scale(-1, v);
}

function isZero(v) {
    return v[0] === 0 && v[1] === 0 && v[2] === 0;
}

function dot(u, v) {
    return (u[0] * v[0]
            + u[1] * v[1]
            + u[2] * v[2]);
}

function norm(v) {
    return Math.sqrt(dot(v, v));
}

function normalize(v) {
    var length = norm(v);
    return scale(length === 0 ? 0 : 1/length, v);
}

function cross(u, v) {
    return [u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0]];
}

function clamp(v, lo, hi) {
    lo = (typeof lo === "number") ? Vector3(lo) : lo;
    hi = (typeof hi === "number") ? Vector3(hi) : hi;
    return [clip(v[0], lo[0], hi[0]),
            clip(v[1], lo[1], hi[1]),
            clip(v[2], lo[2], hi[2])];
}

function clip(x, lo, hi) {
    return Math.max(lo, Math.min(x, hi));
}

var ZERO = Vector3(0);    // TODO rename to Origin? -- no: also used for light

module.exports.Vector3 = Vector3;
module.exports.add = add;
module.exports.sub = sub;
module.exports.mul = mul;
module.exports.scale = scale;
module.exports.neg = neg;
module.exports.isZero = isZero;
module.exports.dot = dot;
module.exports.norm = norm;
module.exports.normalize = normalize;
module.exports.cross = cross;
module.exports.clamp = clamp;
module.exports.clip = clip;
module.exports.ZERO = ZERO;


// Tests mostly from Clojure port

/// ZERO
//. 0,0,0
/// Vector3(42)
//. 42,42,42
/// Vector3(1,4,9)
//. 1,4,9

/// var dyn100 = sub([1, 2, 3], [0, 2, 3]);
/// var dyn010 = sub([1, 2, 3], [1, 1, 3]);

/// clamp([2,-1,-1], 0, 1)
//. 1,0,0
/// clamp([.5,.5,.5], 0, 1)
//. 0.5,0.5,0.5

/// dot([1,1,1], [-1,1,0])
//. 0
/// dot([1,2,3], [3,-2,1])
//. 2

/// add([1,1,0], ZERO)
//. 1,1,0
/// add(ZERO, [-2,3,4])
//. -2,3,4
/// add([1,-1,2], [0,3,1])
//. 1,2,3
/// add(dyn100, dyn010)
//. 1,1,0

/// sub([1,2,3], ZERO)
//. 1,2,3
/// sub([1,2,3], [1,2,3])
//. 0,0,0
/// sub([1,2,3], [3,2,1])
//. -2,0,2
/// sub(dyn100, dyn010)
//. 1,-1,0

/// scale(0, [1,2,3])
//. 0,0,0
/// scale(-1, [1,2,3])
//. -1,-2,-3
/// scale(2, [1,2,3])
//. 2,4,6
/// scale(2, dyn100)
//. 2,0,0

/// cross([1,2,3], [4,5,6])
//. -3,6,-3
/// cross([1,0,0], [0,1,0])
//. 0,0,1
/// cross([1,0,0], [1,0,0])
//. 0,0,0
/// cross(dyn100, dyn010)
//. 0,0,1

/// norm(ZERO)
//. 0
/// norm([1,1,1]) === Math.sqrt(3)
//. true
/// norm([1,0,1]) === Math.SQRT2
//. true

/// sub(normalize([2,3,6]), [2/7, 3/7, 6/7])
//. 0,0,0

},{}]},{},[4]);
