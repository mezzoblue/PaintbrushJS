//
//
//
//			you can pretty much ignore this file
//			it's an alternate take at implementing a convolution matrix and will go away once that's done
//
//
//






			// http://forum.processing.org/topic/controlled-blur-or-edge-detect-effect-using-convolution-kernel


			case "filter-kernel":

				// 3x3 matrix can be any combination of digits, though to maintain brightness they should add up to 1
				// (-1 x 8 + 9 = 1)
				// (write a function to normalize all)
				var matrix = [
/*
					-1,		-1,		-1,
					-1,		9,		-1,
					-1,		-1,		-1
*/

					0,		-1,		0,
					-1,		5,		-1,
					0,		-1,		0

/*
					0.111,		0.111,		0.111,
					0.111,		0.111,		0.111,
					0.111,		0.111,		0.111
*/
				];
				matrix = normalizeMatrix(matrix);


				// index, prevRow, nextRow = scale 4
				// imgwidth = scale 1
				var prevRow = index - (imgWidth - 1) * 4;
				var nextRow = index + (imgWidth + 1) * 4;

				tempR = applyMatrix(data, matrix, index, prevRow, nextRow);
				tempG = applyMatrix(data, matrix, index + 1, prevRow, nextRow);
				tempB = applyMatrix(data, matrix, index + 2, prevRow, nextRow);

				data = setRGB(data, index, 
					findColorDifference(params.kernelAmount, tempR, thisPixel.r),
					findColorDifference(params.kernelAmount, tempG, thisPixel.g),
					findColorDifference(params.kernelAmount, tempB, thisPixel.b));
				break;










	function applyMatrix(data, matrix, index, prevRow, nextRow) {
/* 		console.log(matrix); */
		var temp = (
				data[prevRow - 4] * matrix[0] + data[prevRow] * matrix[1] + data[prevRow + 4] * matrix[2] +
				data[index - 4] * matrix[3] + data[index] * matrix[4] + data[index + 4] * matrix[5] +
				data[nextRow - 4] * matrix[6] + data[nextRow] * matrix[7] + data[nextRow + 4] * matrix[8]
		);
		return temp;
	}



	function normalizeMatrix(matrix) {
		console.log(matrix[4]);
		for (var i = 0, j = 0; i < matrix.length; i++) {
			j += matrix[i];
		}
		for (var i = 0; i < matrix.length; i++) {
			matrix[i] /= j;
		}
		console.log(matrix[4]);
		return matrix;
	}

/*
	function normalizeKernel( ar ) {
		for (var i = 0, n = 0; i < ar.length; i++)
		n += ar[i];
		for (var i = 0; i < ar.length; i++)
		ar[i] /= n;
		
		return ar;
	}
*/

