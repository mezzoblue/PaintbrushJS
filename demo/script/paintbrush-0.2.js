// --------------------------------------------------
//
// paintbrush.js, v0.2
// A browser-based image processing library for HTML5 canvas
// Developed by Dave Shea, http://www.mezzoblue.com/
//
// This project lives on GitHub:
//    http://github.com/mezzoblue/PaintbrushJS
//
// Except where otherwise noted, PaintbrushJS is licensed under the MIT License:
//    http://www.opensource.org/licenses/mit-license.php
//
// --------------------------------------------------




// basic loader function to attach all filters being used within the page
addLoadEvent(function() {

	// only use this if you're going to time the script, otherwise you can safely delete the next three lines
	if(!(typeof(runTimer) == 'undefined')) {
	 	var s = startTimer();
	}
 
	// only run if this browser supports canvas, obviously
	if (supports_canvas()) {
		// you can add or remove lines here, depending on which filters you're using.
		addFilter("filter-blur");
		addFilter("filter-greyscale");
		addFilter("filter-mosaic");
		addFilter("filter-noise");
		addFilter("filter-posterize");
		addFilter("filter-sepia");
		addFilter("filter-tint");

		// early experimental phase
		addFilter("filter-matrix");
	}

	// only use this if you're going to time the script, otherwise you can safely delete the next three lines
	if(!(typeof(runTimer) == 'undefined')) {
		endTimer(s);
	}

});





// the main workhorse function
function addFilter(filterType) {

	
	// get every element with the specified filter class
	toFilter = getElementsByClassName(filterType);

	// now let's loop through those elements
	for(var current in toFilter) {

		// load all specified parameters for this filter
		params = getFilterParameters(toFilter[current]);

		// get the image we're going to work with
		var img = getReferenceImage(toFilter[current]);

		// make sure we've actually got something to work with
		img.onLoad = processFilters(filterType, img, params, current, toFilter);
	}


	function processFilters(filterType, img, params, current, toFilter) {

		// create working buffer
		var buffer = document.createElement("canvas");
		// get the canvas context
		var c = buffer.getContext('2d');

		// set buffer dimensions to image dimensions
		c.width = buffer.width = img.width;
		c.height = buffer.height = img.height;


		if (img && c) {
			// create the temporary pixel array we'll be manipulating
			var pixels = initializeBuffer(c, img);

			if (pixels) {
				//					
				// pre-processing for various filters
				//
				// blur and matrix filters have to exist outside the main loop
				if (filterType == "filter-blur") {
					pixels = gaussianBlur(img, pixels, params.blurAmount);
				}
				if (filterType == "filter-matrix") {
					pixels = applyMatrix(img, pixels, params);
				}


				// we need to figure out RGB values for tint, let's do that ahead and not waste time in the loop
				if (filterType == "filter-tint") {
					var src  = parseInt(createColor(params.tintColor), 16),
					    dest = {r: ((src & 0xFF0000) >> 16), g: ((src & 0x00FF00) >> 8), b: (src & 0x0000FF)};
				}
				
		
				
				if (filterType != "filter-blur") {
					// the main loop through every pixel to apply effects
					// (data is per-byte, and there are 4 bytes per pixel, so lets only loop through each pixel and save a few cycles)
					for (var i = 0, data = pixels.data, length = data.length; i < length >> 2; i++) {
						var index = i << 2;
			
						// get each colour value of current pixel
						var thisPixel = {r: data[index], g: data[index + 1], b: data[index + 2]};
			
						// the biggie: if we're here, let's get some filter action happening
						pixels = applyFilters(filterType, params, img, pixels, index, thisPixel, dest);
					}
				}
		
				// redraw the pixel data back to the working buffer
				c.putImageData(pixels, 0, 0);
				
				// finally, replace the original image data with the buffer
				placeReferenceImage(toFilter[current], buffer);
			}
		}
	}





	// sniff whether this is an actual img element, or some other element with a background image
	function getReferenceImage(ref) {
		if (ref.nodeName == "IMG") {
			// create a reference to the image
			return ref;
		} 
		
		// otherwise check if a background image exists
		var bg = window.getComputedStyle(ref, null).backgroundImage;
		
		// if so, we're going to pull it out and create a new img element in the DOM
		if (bg) {
			var img = new Image();
			// kill quotes in background image declaration, if they exist
			// and return just the URL itself
			img.src = bg.replace(/['"]/g,'').slice(4, -1);
			return img;
		}
		return false;
	}

	// re-draw manipulated pixels to the reference image, regardless whether it was an img element or some other element with a background image
	function placeReferenceImage(ref, buffer) {
		// dump the buffer as a DataURL
		result = buffer.toDataURL("image/png");
		if (ref.nodeName == "IMG") {
			img.src = result;
		} else {
			ref.style.backgroundImage = "url(" + result + ")";
		}
	}


	// throw the data-* attributes into a JSON object
	function getFilterParameters(ref) {

		// create the params object and set some default parameters up front
		var params = {
			"blurAmount"		:	1,		// 0 and higher
			"greyscaleAmount"	:	1,		// between 0 and 1
			"mosaicAmount"		:	1,		// between 0 and 1
			"mosaicSize"		:	5,		// 1 and higher
			"noiseAmount"		:	30,		// 0 and higher
			"noiseType"			:	"mono",	// mono or color
			"posterizeAmount"	:	5,		// 0 - 255, though 0 and 1 are relatively useless
			"sepiaAmount"		:	1,		// between 0 and 1
			"tintAmount"		:	0.3,	// between 0 and 1
			"tintColor"			:	"#FFF",	// any hex color

			"matrixAmount"		:	0.2		// between 0 and 1
		};
		
		// check for every attribute, throw it into the params object if it exists.
		for (var filterName in params){
			// "blurAmount" ==> "data-pb-blur-amount"
			var hyphenated = filterName.replace(/([A-Z])/g, function(all, letter) {  
				return '-' + letter.toLowerCase(); 
			}),
			attr = ref.getAttribute("data-pb-" + hyphenated);
			if (attr) {
				params[filterName] = attr;
			}
		}

		// O Canada, I got your back. (And UK, AU, NZ, IE, etc.)
		params['tintColor'] = ref.getAttribute("data-pb-tint-colour") || params['tintColor'];

		// Posterize requires a couple more generated values, lets keep them out of the loop
		params['posterizeAreas'] = 256 / params.posterizeAmount;
		params['posterizeValues'] = 255 / (params.posterizeAmount - 1);

		return(params);
	}


	
	function initializeBuffer(c, img) {
		// clean up the buffer between iterations
		c.clearRect(0, 0, c.width, c.height);
		// make sure we're drawing something
		if (img.width > 0 && img.height > 0) {

			// console.log(img.width, img.height, c.width, c.height);

			try {
				// draw the image to buffer and load its pixels into an array
				//   (remove the last two arguments on this function if you choose not to 
				//    respect width/height attributes and want the original image dimensions instead)
				c.drawImage(img, 0, 0, img.width , img.height);
				return(c.getImageData(0, 0, c.width, c.height));

			} catch(err) {
				// it's kinda strange, I'm explicitly checking for width/height above, but some attempts
				// throw an INDEX_SIZE_ERR as if I'm trying to draw a 0x0 or negative image, as per 
				// http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#images
				//
				// AND YET, if I simply catch the exception, the filters render anyway and all is well.
				// there must be a reason for this, I just don't know what it is yet.
				//
				// console.log("exception: " + err);
			}
		}

	}




	// parse a shorthand or longhand hex string, with or without the leading '#', into something usable
	function createColor(src) {
		// strip the leading #, if it exists
		src = src.replace(/^#/, '');
		// if it's shorthand, expand the values
		if (src.length == 3) {
			src = src.replace(/(.)/g, '$1$1');
		}
		return(src);
	}

	// find a specified distance between two colours
	function findColorDifference(dif, dest, src) {
		return(dif * dest + (1 - dif) * src);
	}

	// throw three new RGB values into the pixels object at a specific spot
	function setRGB(data, index, r, g, b) {
		data[index] = r;
		data[index + 1] = g;
		data[index + 2] = b;
		return data;
	}
	

	// the function that actually manipulates the pixels
	function applyFilters(filterType, params, img, pixels, index, thisPixel, dest) {

		// speed up access
		var data = pixels.data, val;

		// figure out which filter to apply, and do it	
		switch(filterType) {

			case "filter-greyscale":
				val = (thisPixel.r * 0.21) + (thisPixel.g * 0.71) + (thisPixel.b * 0.07);
				data = setRGB(data, index, 
					findColorDifference(params.greyscaleAmount, val, thisPixel.r),
					findColorDifference(params.greyscaleAmount, val, thisPixel.g),
					findColorDifference(params.greyscaleAmount, val, thisPixel.b));
				break;

			case "filter-mosaic":
				var stepX = ((index >> 2) % params.mosaicSize) << 2;
				var stepY = (Math.floor(((index >> 2) / img.width)) % params.mosaicSize) << 2;
				var pos = index - stepX - img.width * stepY;
				data = setRGB(data, index,
					findColorDifference(params.mosaicAmount, data[pos], thisPixel.r),
					findColorDifference(params.mosaicAmount, data[pos + 1], thisPixel.g),
					findColorDifference(params.mosaicAmount, data[pos + 2], thisPixel.b));
				break;

			case "filter-noise":
				val = noise(params.noiseAmount);

				if ((params.noiseType == "mono") || (params.noiseType == "monochrome")) {
					data = setRGB(data, index, 
						checkRGBBoundary(thisPixel.r + val),
						checkRGBBoundary(thisPixel.g + val),
						checkRGBBoundary(thisPixel.b + val));
				} else {
					data = setRGB(data, index, 
						checkRGBBoundary(thisPixel.r + noise(params.noiseAmount)),
						checkRGBBoundary(thisPixel.g + noise(params.noiseAmount)),
						checkRGBBoundary(thisPixel.b + noise(params.noiseAmount)));
				}
				break;

			case "filter-posterize":
				data = setRGB(data, index, 
					parseInt(params.posterizeValues * parseInt(thisPixel.r / params.posterizeAreas)),
					parseInt(params.posterizeValues * parseInt(thisPixel.g / params.posterizeAreas)),
					parseInt(params.posterizeValues * parseInt(thisPixel.b / params.posterizeAreas)));
				break;

			case "filter-sepia":
				data = setRGB(data, index, 
					findColorDifference(params.sepiaAmount, (thisPixel.r * 0.393) + (thisPixel.g * 0.769) + (thisPixel.b * 0.189), thisPixel.r),
					findColorDifference(params.sepiaAmount, (thisPixel.r * 0.349) + (thisPixel.g * 0.686) + (thisPixel.b * 0.168), thisPixel.g),
					findColorDifference(params.sepiaAmount, (thisPixel.r * 0.272) + (thisPixel.g * 0.534) + (thisPixel.b * 0.131), thisPixel.b));
				break;

			case "filter-tint":
				data = setRGB(data, index, 
					findColorDifference(params.tintAmount, dest.r, thisPixel.r),
					findColorDifference(params.tintAmount, dest.g, thisPixel.g),
					findColorDifference(params.tintAmount, dest.b, thisPixel.b));
				break;


		}
		return(pixels);
	}



	function applyMatrix(img, pixels, params) {

		// -------------
		// been leaning on this a lot:
		// http://forum.processing.org/topic/controlled-blur-or-edge-detect-effect-using-convolution-kernel
		// -------------

		// speed up access
		var data = pixels.data, imgWidth = img.width;

		// 3x3 matrix can be any combination of digits, though to maintain brightness they should add up to 1
		// (-1 x 8 + 9 = 1)
		var matrix = [
			-1,		-1,		-1,
			-1,		9,		-1,
			-1,		-1,		-1

/*
			0,		-1,		0,
			-1,		5,		-1,
			0,		-1,		0
*/

/*
			0.111,		0.111,		0.111,
			0.111,		0.111,		0.111,
			0.111,		0.111,		0.111
*/

		];
		
		// though theoretically we're also going to account for non-1 arrays
		matrix = normalizeMatrix(matrix);

		// calculate the dimensions, just in case this ever expands to 5 and beyond
		var matrixSize = Math.sqrt(matrix.length);
		
		// loop through every pixel
		for (var i = 1; i < imgWidth - 1; i++) {
			for (var j = 1; j < img.height - 1; j++) {

				// temporary holders for matrix results
				var sumR = sumG = sumB = 0;

				// loop through the matrix itself
				for (var h = 0; h < matrixSize; h++) {
					for (var w = 0; w < matrixSize; w++) {

						// get a refence to a pixel position in the matrix
						var r = convertCoordinates(i + h - 1, j + w - 1, imgWidth) << 2;

						// find RGB values for that pixel
						var currentPixel = {
							r: data[r],
							g: data[r + 1],
							b: data[r + 2]
						};

						// apply the value from the current matrix position
						sumR += currentPixel.r * matrix[w + h * matrixSize];
						sumG += currentPixel.g * matrix[w + h * matrixSize];
						sumB += currentPixel.b * matrix[w + h * matrixSize];
					}
				}
				

      				
				// get a reference for the final pixel
				var ref = convertCoordinates(i, j, imgWidth) << 2;
				var thisPixel = {
							r: data[ref],
							g: data[ref + 1],
							b: data[ref + 2]
						};
				
				// finally, apply the adjusted values
				data = setRGB(data, ref, 
					findColorDifference(params.matrixAmount, sumR, thisPixel.r),
					findColorDifference(params.matrixAmount, sumG, thisPixel.g),
					findColorDifference(params.matrixAmount, sumB, thisPixel.b));
			}
		}

		return(pixels);
	}


	// convert x/y coordinates to pixel index reference
	function convertCoordinates(x, y, w) {
		return x + (y * w);
	}

	// ensure that values in the matrix add up to 1
	function normalizeMatrix(matrix) {
		var j = 0;
		for (var i = 0; i < matrix.length; i++) {
			j += matrix[i];
		}
		for (var i = 0; i < matrix.length; i++) {
			matrix[i] /= j;
		}
		return matrix;
	}




	// calculate random noise. different every time!
	function noise(noiseValue) {
		return Math.floor(noiseValue / 2 - (Math.random() * noiseValue));
	}
	
	// ensure an RGB value isn't negative / over 255
	function checkRGBBoundary(val) {
		if (val < 0) {
			return 0;
		} else if (val > 255) {
			return 255;
		} else {
			return val;
		}
	}

}
