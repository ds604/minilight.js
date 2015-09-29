"use strict";

// Maximum number of objects in Scene.
// (2^24 ~= 16 million)
var TRIANGLES_MAX = 0x1000000;

function Scene(stream, eyePosition) {
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
}

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
