A javascript port of minilight http://www.hxa.name/minilight/

Original by Harrison Ainsworth / HXA7241 : 2010
released under BSD license or UNLICENSE http://unlicense.org/

JS port by Darius Bacon


todo
----

* modularize the code
* create browser bundle
* explore ('gl-matrix').vec3 module instead of re-inventing the wheel
* explore clamp module
* proper README. this sucks.
* better UI, interaction
   * use webworkers to put rendering in a background thread
      * all communication is serialised
      * pass frame data back like image saving
* speed up
* Random
   * 53 bit precision version ?