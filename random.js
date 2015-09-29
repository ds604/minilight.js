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


// uses: Math




"use strict";




/**
 * Make a random generator (32 bit precision version).
 *
 * @param  seed [integer|falsy] positive < 2^32, or zero or falsy for default
 * @return [function[-> real[0-1]]] generator
 */
var randomGenerator = function( seed )
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
