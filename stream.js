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
var streamer = function( str, id )
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


var Real = function( str ) { return parseFloat(str); };
Real.regex = "(\\S+)";
