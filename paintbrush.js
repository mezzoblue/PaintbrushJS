// --------------------------------------------------
//
// paintbrush.js, v0.3
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




// basic loader function to attach all filters used within the page
addLoadEvent(function() {
	processFilters();
});



// function to process all filters
// (exists outside of loader to enable standalone use)
function processFilters() {

	// create working buffer outside the main loop so it's only done once
	var buffer = document.createElement("canvas");
	// get the canvas context
	var c = buffer.getContext('2d');

	// only run if this browser supports canvas, obviously
	if (supports_canvas()) {
		// you can add or remove lines here, depending on which filters you're using.
		addFilter("filter-blur", buffer, c);
		addFilter("filter-edges", buffer, c);
		addFilter("filter-emboss", buffer, c);
		addFilter("filter-greyscale", buffer, c);
		addFilter("filter-matrix", buffer, c);
		addFilter("filter-mosaic", buffer, c);
		addFilter("filter-noise", buffer, c);
		addFilter("filter-posterize", buffer, c);
		addFilter("filter-sepia", buffer, c);
		addFilter("filter-sharpen", buffer, c);
		addFilter("filter-tint", buffer, c);
	}
}


// the main workhorse function
function addFilter(filterType, buffer, c) {

	// get every element with the specified filter class
	var toFilter = getElementsByClassName(filterType.toLowerCase());

	// now let's loop through those elements
	for(var current in toFilter) {

		// load all specified parameters for this filter
		var params = getFilterParameters(toFilter[current]);

		// get the image we're going to work with
		var img = getReferenceImage(toFilter[current]);

		// make sure we've actually got something to work with
		img.onLoad = processFilters(filterType, img, params, toFilter, current, buffer, c);
	}


	function processFilters(filterType, img, params, toFilter, current, buffer, c) {

		// quick access to original element
		var ref = toFilter[current];

		// original image copy naming convention
		var originalSuffix = filterType + "-" + current;

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
				// blur and all matrix filters have to exist outside the main loop
				if (filterType == "filter-blur") {
					pixels = gaussianBlur(img, pixels, params.blurAmount);
				}

				if (filterType == "filter-edges") {
					var matrix = [
						0,		1,		0,
						1,		-4,		1,
						0,		1,		0
					];
					pixels = applyMatrix(img, pixels, matrix, params.edgesAmount);
				}
				if (filterType == "filter-emboss") {
					var matrix = [
						-2,		-1,		0,
						-1,		1,		1,
						0,		1,		2
					];
					pixels = applyMatrix(img, pixels, matrix, params.embossAmount);
				}
				if (filterType == "filter-matrix") {
					// 3x3 matrix can be any combination of digits, though to maintain brightness they should add up to 1
					// (-1 x 8 + 9 = 1)

					var matrix = [
						// box blur default
						0.111,		0.111,		0.111,
						0.111,		0.111,		0.111,
						0.111,		0.111,		0.111
					];

					pixels = applyMatrix(img, pixels, matrix, params.matrixAmount);
				}
				if (filterType == "filter-sharpen") {
					var matrix = [
						-1,		-1,		-1,
						-1,		9,		-1,
						-1,		-1,		-1
					];
					pixels = applyMatrix(img, pixels, matrix, params.sharpenAmount);
				}

				// we need to figure out RGB values for tint, let's do that ahead and not waste time in the loop
				if (filterType == "filter-tint") {
					var src  = parseInt(createColor(params.tintColor), 16),
					    dest = {r: ((src & 0xFF0000) >> 16), g: ((src & 0x00FF00) >> 8), b: (src & 0x0000FF)};
				}

				if ((filterType != "filter-blur") 
					&& (filterType != "filter-emboss")
					&& (filterType != "filter-matrix")
					&& (filterType != "filter-sharpen")
				) {
					// the main loop through every pixel to apply the simpler effects
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
				

				// stash a copy and let the original know how to reference it
				stashOriginal(img, originalSuffix, ref, buffer);
			
			}
		}
	}


	// the function that actually manipulates the pixels
	function applyFilters(filterType, params, img, pixels, index, thisPixel, dest) {

		// speed up access
		var data = pixels.data, val;
		var imgWidth = img.width;

		// figure out which filter to apply, and do it	
		switch(filterType) {

			case "filter-greyscale":
				val = (thisPixel.r * 0.21) + (thisPixel.g * 0.71) + (thisPixel.b * 0.07);
				data = setRGB(data, index, 
					findColorDifference(params.greyscaleOpacity, val, thisPixel.r),
					findColorDifference(params.greyscaleOpacity, val, thisPixel.g),
					findColorDifference(params.greyscaleOpacity, val, thisPixel.b));
				break;

			case "filter-mosaic":
				// a bit more verbose to reduce amount of math necessary
				var pos = index >> 2;
				var stepY = Math.floor(pos / imgWidth);
				var stepY1 = stepY % params.mosaicSize;
				var stepX = pos - (stepY * imgWidth);
				var stepX1 = stepX % params.mosaicSize;

				if (stepY1) pos -= stepY1 * imgWidth;
				if (stepX1) pos -= stepX1;
				pos = pos << 2;

				data = setRGB(data, index,
					findColorDifference(params.mosaicOpacity, data[pos], thisPixel.r),
					findColorDifference(params.mosaicOpacity, data[pos + 1], thisPixel.g),
					findColorDifference(params.mosaicOpacity, data[pos + 2], thisPixel.b));
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
					findColorDifference(params.posterizeOpacity, parseInt(params.posterizeValues * parseInt(thisPixel.r / params.posterizeAreas)), thisPixel.r),
					findColorDifference(params.posterizeOpacity, parseInt(params.posterizeValues * parseInt(thisPixel.g / params.posterizeAreas)), thisPixel.g),
					findColorDifference(params.posterizeOpacity, parseInt(params.posterizeValues * parseInt(thisPixel.b / params.posterizeAreas)), thisPixel.b));
				break;

			case "filter-sepia":
				data = setRGB(data, index, 
					findColorDifference(params.sepiaOpacity, (thisPixel.r * 0.393) + (thisPixel.g * 0.769) + (thisPixel.b * 0.189), thisPixel.r),
					findColorDifference(params.sepiaOpacity, (thisPixel.r * 0.349) + (thisPixel.g * 0.686) + (thisPixel.b * 0.168), thisPixel.g),
					findColorDifference(params.sepiaOpacity, (thisPixel.r * 0.272) + (thisPixel.g * 0.534) + (thisPixel.b * 0.131), thisPixel.b));
				break;

			case "filter-tint":
				data = setRGB(data, index, 
					findColorDifference(params.tintOpacity, dest.r, thisPixel.r),
					findColorDifference(params.tintOpacity, dest.g, thisPixel.g),
					findColorDifference(params.tintOpacity, dest.b, thisPixel.b));
				break;


		}
		return(pixels);
	}


	// apply a convolution matrix
	function applyMatrix(img, pixels, matrix, amount) {

		// create a second buffer to hold matrix results
		var buffer2 = document.createElement("canvas");
		// get the canvas context 
		var c2 = buffer2.getContext('2d');

		// set the dimensions
		c2.width = buffer2.width = img.width;
		c2.height = buffer2.height = img.height;

		// draw the image to the new buffer
		c2.drawImage(img, 0, 0, img.width , img.height);
		var bufferedPixels = c2.getImageData(0, 0, c.width, c.height)

		// speed up access
		var data = pixels.data, bufferedData = bufferedPixels.data, imgWidth = img.width;

		// make sure the matrix adds up to 1
/* 		matrix = normalizeMatrix(matrix); */

		// calculate the size of the matrix
		var matrixSize = Math.sqrt(matrix.length);
		// also store the size of the kernel radius (half the size of the matrix)
		var kernelRadius = Math.floor(matrixSize / 2);
		
		// loop through every pixel
		for (var i = 1; i < imgWidth - 1; i++) {
			for (var j = 1; j < img.height - 1; j++) {

				// temporary holders for matrix results
				var sumR = sumG = sumB = 0;

				// loop through the matrix itself
				for (var h = 0; h < matrixSize; h++) {
					for (var w = 0; w < matrixSize; w++) {

						// get a refence to a pixel position in the matrix
						var r = convertCoordinates(i + w - kernelRadius, j + h - kernelRadius, imgWidth) << 2;

						// find RGB values for that pixel
						var currentPixel = {
							r: bufferedData[r],
							g: bufferedData[r + 1],
							b: bufferedData[r + 2]
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
					findColorDifference(amount, sumR, thisPixel.r),
					findColorDifference(amount, sumG, thisPixel.g),
					findColorDifference(amount, sumB, thisPixel.b));
			}
		}

		// code to clean the secondary buffer out of the DOM would be good here

		return(pixels);
	}

	// ensure that values in a matrix add up to 1
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



	// convert x/y coordinates to pixel index reference
	function convertCoordinates(x, y, w) {
		return x + (y * w);
	}

	// calculate random noise. different every time!
	function noise(noiseValue) {
		return Math.floor((noiseValue >> 1) - (Math.random() * noiseValue));
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



// throw the data-* attributes into a JSON object
function getFilterParameters(ref) {

	// create the params object and set some default parameters up front
	var params = {
		"blurAmount"		:	1,		// 0 and higher
		"edgesAmount"		:	1,		// between 0 and 1
		"embossAmount"		:	0.25,	// between 0 and 1
		"greyscaleOpacity"	:	1,		// between 0 and 1
		"matrixAmount"		:	1,		// between 0 and 1
		"mosaicOpacity"		:	1,		// between 0 and 1
		"mosaicSize"		:	5,		// 1 and higher
		"noiseAmount"		:	30,		// 0 and higher
		"noiseType"			:	"mono",	// mono or color
		"posterizeAmount"	:	5,		// 0 - 255, though 0 and 1 are relatively useless
		"posterizeOpacity"	:	1,		// between 0 and 1
		"sepiaOpacity"		:	1,		// between 0 and 1
		"sharpenAmount"		:	0.25,	// between 0 and 1
		"tintColor"			:	"#FFF",	// any hex color
		"tintOpacity"		:	0.3		// between 0 and 1
	};
	
	// check for every attribute, throw it into the params object if it exists.
	for (var filterName in params){
		// "tintColor" ==> "data-pb-tint-color"
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
function placeReferenceImage(ref, result, img) {
	// dump the buffer as a DataURL
	if (ref.nodeName == "IMG") {
		img.src = result;
	} else {
		ref.style.backgroundImage = "url(" + result + ")";
	}
}
	
// add specified attribute name with specified value to passed object
function addAttribute(obj, name, value) {
	var newAttr = document.createAttribute(name);
	newAttr.nodeValue = value;
	return obj.setAttributeNode(newAttr);
}


// clear reference object's data-pb-* attributes
function flushDataAttributes(img) {
	for (var i = 0; i < img.attributes.length; i++) {
		var thisAttr = img.attributes[i].name;
		if (thisAttr.substr(0, 8) == "data-pb-") {
			img.removeAttribute(thisAttr);
		}
	}
}

// remove any Paintbrush classes from the reference image
function removeClasses(obj) {
	// get classes of the reference image
	var classList = (obj.className.toLowerCase()).split(' ');
	for (var i = 0; i < classList.length; i++) {

		// clean up any existing filter-* classes
		if (classList[i].substr(0, 7) == "filter-") {
			removeClass(obj, classList[i]);
		}
	}
}


// clean up stashed original copies and reference classes
function destroyStash(img, preserve) {

	var classList = (img.className.toLowerCase()).split(' ');
	for (var i = 0; i < classList.length; i++) {

		// quick reference
		var currentClass = classList[i];

		// have we found an original class?
		if (currentClass.substr(0, 7) == "pb-ref-") {

			// get the original object too
			var original = document.getElementById("pb-original-" + currentClass.substr(7, currentClass.length - 7));
			
			// replace current with original if the preserve flag is set
			if (preserve) {
				img.src = original.src;
			}

			// kill them, kill them all
			removeClass(img, currentClass);
			
			d = document.body;
			throwaway = d.removeChild(original);

		}
	}
	
}

function stashOriginal(img, originalSuffix, ref, buffer) {

	// store the original image in the DOM
	var stashed = stashInDom(img, originalSuffix);

	// then replace the original image data with the buffer
	placeReferenceImage(ref, buffer.toDataURL("image/png"), img);
	
	// and finally, add a class that references the stashed original image for later use
	// (but only if we actually stashed one above)
	if (stashed) {
		ref.className += " pb-ref-" + originalSuffix;
	}
}

// stash a copy of the original image in the DOM for later use
function stashInDom(img, originalSuffix) {
	
	var orig = "pb-original-" + originalSuffix;

	// make sure we're not re-adding on repeat calls
	if (!document.getElementById(orig)) {

		// create the stashed img element
		var original = document.createElement("img");

		// set the attributes
		original.src = img.src;
		original.id = orig;
		original.style.display = "none";
		document.body.appendChild(original);
		
		return true;
	} else {
		return false;
	}
}
