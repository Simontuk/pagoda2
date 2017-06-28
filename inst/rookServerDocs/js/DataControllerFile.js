"use strict";

/**
 * Handles data access to pagoda2 files
 * @description provides a dataController interface backed by pagoda2 files
 * The object can connect either to remove or local files using different filereader
 * initialisation, according to the parameters provided by loadParams
 */
function DataControllerFile(loadParams) {
  var frTemp;

  if(loadParams.connectionType == 'remoteFile') {
    frTemp = new p2FileReader('remote', loadParams.remoteFileUrl,null);
  } else if (loadParams.connectionType == 'localFile') {
    frTemp = new p2FileReader('local', null, loadParams.fileRef);
  }

  // Generate format reader that will use the p2File Reader to access the data
  // the format reader handles the top level index and resolution to file locations
  // the file reader is responsible for obtaining the data in the requested range
  this.formatReader = new p2FormatReader(frTemp);
  this.formatReader.onReady = function() { console.log('Format reader is ready.'); }
  this.formatReader.readHeaderIndex();

  // object for storing the preloaded information for the sparse array
  // this includes offsets and the p vector
  this.sparseArrayPreloadInfo = null;
  this.aspectArrayPreloadInfo = null;
  this.aspectInformation = null;
  this.geneInformationMapCache = null;
}

/**
 * Returns the reduced dendrogram
 */
DataControllerFile.prototype.getReducedDendrogram = function(callback) {
  // FIXME: Assume format reader is ready here
  var fr = this.formatReader;

  var fn = function() {
        fr.getEntryAsText('reduceddendrogram', function(text) {
      		// Find lenght of null terminated string
          var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      		var textTrimmed = text.slice(0, dataLength);
      		callback(JSON.parse(textTrimmed));

  	 }, fr);
  }

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
}


/**
 * Get the cell order
 */
DataControllerFile.prototype.getCellOrder = function(callback) {
  // FIXME: Assume format reader is ready here
  var fr = this.formatReader;

  var fn = function() {
        fr.getEntryAsText('cellorder', function(text) {
          var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      		var textTrimmed = text.slice(0, dataLength);
      		callback(JSON.parse(textTrimmed));

  	 }, fr);
  }

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
}


/**
 * Get the cell metadata
 */
DataControllerFile.prototype.getCellMetadata = function(callback, callbackParameters) {
  // FIXME: Assume format reader is ready here
  var fr = this.formatReader;

  var fn = function() {
        fr.getEntryAsText('cellmetadata', function(text) {
      		var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);

      		var textTrimmed = text.slice(0, dataLength);
      		callback(JSON.parse(textTrimmed), callbackParameters);

  	 }, fr);
  }

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }

};


/**
 * Get the gene information store
 */
DataControllerFile.prototype.getGeneInformationStore = function(callback) {
  var fr = this.formatReader;

  var fn = function() {
        fr.getEntryAsText('geneinformation', function(text) {

          var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      		var textTrimmed = text.slice(0, dataLength);

      		var data = JSON.parse(textTrimmed);

      		var pagingStore = Ext.create('LocalJsonStore', {
        		autoLoad: true,
        		model: 'geneTableEntry',
        		pageSize: 100,
        		localData: data,
    	    });
    	    pagingStore.sort('dispersion', 'DESC');
    	    callback(pagingStore);
  	 }, fr);
  };

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
};

/**
 * Get the hierarchy of embeddings and reductions
 * @private
 */
DataControllerFile.prototype.getEmbeddingStructure = function(callback) {
  var fr = this.formatReader;

  var fn = function() {
        fr.getEntryAsText('embeddingstructure', function(text) {
      		var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);

      		var textTrimmed = text.slice(0, dataLength);
      		callback(JSON.parse(textTrimmed));

  	 }, fr);
  }

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
};


/**
 * Loads the embedding structure that provides information
 * about the reduction and embedding hierarchy
 */
DataControllerFile.prototype.getAvailableReductionTypes = function(callback) {
  this.getEmbeddingStructure(function(data) {
    var ret = [];
    for(var i in data) {
      ret.push(i);
    }
    callback(ret);
  });
};

/**
 * Get the specified embedding
 */
DataControllerFile.prototype.getEmbedding = function(type, embeddingType, callback) {

  var fr = this.formatReader;

  this.getEmbeddingStructure(function(data) {
    var embRecordId = data[type][embeddingType];

    var fn = function() {
          fr.getEntryAsText(embRecordId, function(text) {
        		var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);

        		var textTrimmed = text.slice(0, dataLength);
        		var data = JSON.parse(textTrimmed);

        		// TODO: Check that the arrays contain numbers
        		var unpackedValues = DataControllerServer.prototype.unpackCompressedBase64Float64Array(data.values);
        		data.values = unpackedValues;

    		    callback(data);

    	 }, fr);
    };


    // Call immediately or defer to when the object is ready
    if (fr.state == fr.READY) {
      fn();
    } else {
      fr.addEventListener('onready',fn);
    }
    //callback(ret);
  });
};

/**
 * Get a structure with the information locally required for doing requests to the array
 * @description this function will return an object with the information required to access
 * a serialised sparse array with requests of specific ranges in both dimentions
 * This comprises: (1) The start position of the array entry in thefile in blocks (from the file index)
 * (2) The offsets of each elements wrt the starting positions in bytes (obtained from the sparse matrix index)
 * (3) The dimnames (that are stored as json string) (Dimname1 and Dimname2)
 * (4) The full p array
 */
DataControllerFile.prototype.getSparseArrayPreloadInformation = function(entryName, storageVariableName,callback) {
  var fr = this.formatReader;
  var dcf = this;

  // Get the sparse matrix index and cache it. This is 8 uint32_t long (32 bytes)
  fr.getBytesInEntry(entryName, 0, 32, function(data){

    var dataArray = new Uint32Array(data);

    dcf[storageVariableName] = {};
    dcf[storageVariableName].dim1 = dataArray[0];
    dcf[storageVariableName].dim2 = dataArray[1];
    dcf[storageVariableName].pStartOffset = dataArray[2];
    dcf[storageVariableName].iStartOffset = dataArray[3];
    dcf[storageVariableName].xStartOffset = dataArray[4];
    dcf[storageVariableName].dimname1StartOffset = dataArray[5];
    dcf[storageVariableName].dimname2StartOffset = dataArray[6];
    dcf[storageVariableName].dimnames2EndOffset  = dataArray[7];

    dcf[storageVariableName].dimnames1Data = null;
    dcf[storageVariableName].dimnames2Data = null;
    dcf[storageVariableName].parray = null;

    var callCallbackIfReady = function() {
      var ready = false;
      if (dcf[storageVariableName].dimnames1Data !== null &&
       dcf[storageVariableName].dimnames2Data !== null &&
       dcf[storageVariableName].parray !== null) {
         ready = true;
       }

      if (ready) {
        callback();
      }
    }

    var parraylength =  dcf[storageVariableName].iStartOffset -  dcf[storageVariableName].pStartOffset;
    fr.getBytesInEntry(entryName, dcf[storageVariableName].pStartOffset, parraylength, function(buffer){
        dcf[storageVariableName].parray = new Uint32Array(buffer);
        callCallbackIfReady();

    }, fr);

    var dimnames1length = dcf[storageVariableName].dimname2StartOffset - dcf[storageVariableName].dimname1StartOffset - 1; // -1 for null
    fr.getBytesInEntryAsText(entryName, dcf[storageVariableName].dimname1StartOffset, dimnames1length,
      function(data){
        dcf[storageVariableName].dimnames1Data = JSON.parse(data);

        // Build reverse map
        dcf[storageVariableName].dimnames1DataReverse = {};
        for (var i in dcf[storageVariableName].dimnames1Data) {
          dcf[storageVariableName].dimnames1DataReverse[dcf[storageVariableName].dimnames1Data[i]] = parseInt(i);
        }

        callCallbackIfReady();
    },fr);

    var dimnames2length = dcf[storageVariableName].dimnames2EndOffset - dcf[storageVariableName].dimname2StartOffset - 1; // -1 for null
    fr.getBytesInEntryAsText(entryName, dcf[storageVariableName].dimname2StartOffset, dimnames2length,
      function(data){
        dcf[storageVariableName].dimnames2Data = JSON.parse(data);

        // Build reverse map
        dcf[storageVariableName].dimnames2DataReverse = {};
        for (var i in dcf[storageVariableName].dimnames2Data) {
          dcf[storageVariableName].dimnames2DataReverse[dcf[storageVariableName].dimnames2Data[i]] = parseInt(i);
        }

        callCallbackIfReady();
    },fr);

  }, fr);
};

/**
 * Get a single gene column from the file sparse matrix
 * @private
 */
DataControllerFile.prototype.getGeneColumn = function(geneName, geneindex, cellIndexStart, cellIndexEnd, callback) {
  var dcf = this;
  var fr = this.formatReader;

  // Index of the gene
  var geneIndexInSparse = dcf.sparseArrayPreloadInfo.dimnames2DataReverse[geneName];

  // Column start and end index
  var csi = dcf.sparseArrayPreloadInfo.parray[geneIndexInSparse] - 1;
  var cei = dcf.sparseArrayPreloadInfo.parray[geneIndexInSparse + 1]  - 1;

  // Zero filled array with the data for all the cells
  var fullRowArray = new Float32Array(dcf.sparseArrayPreloadInfo.dim1);

  // Get csi to cei for the x array
  const BYTES_PER_FLOAT32 = 4;
  var xArrayOffset = dcf.sparseArrayPreloadInfo.xStartOffset + BYTES_PER_FLOAT32;

  // Byte position in the file that corresponds to the csi and cei indexes
  var csiBytes = xArrayOffset + csi * BYTES_PER_FLOAT32;
  var ceiBytes = xArrayOffset + cei * BYTES_PER_FLOAT32;

  // Get the number of bytes to retrieve
  var xRowLength = ceiBytes - csiBytes;

  // Get the x array bytes (the raw information)
  fr.getBytesInEntry('sparseMatrix', csiBytes, xRowLength, function(buffer) {
    var geneIndexInRequest = geneIndexInRequest;
    var rowXArray = new Float32Array(buffer);

    // Calculate positions of i array entries in the file
    var iArrayOffset = dcf.sparseArrayPreloadInfo.iStartOffset + BYTES_PER_FLOAT32;
    var csiBytesI = iArrayOffset + csi * BYTES_PER_FLOAT32;
    var ceiBytesI = iArrayOffset + cei * BYTES_PER_FLOAT32;
    var xRowLengthI = ceiBytes - csiBytes;

    // Get the p array bytes
    fr.getBytesInEntry('sparseMatrix', csiBytesI, xRowLengthI, function(buffer2) {
      var rowIArray = new Uint32Array(buffer2);

      // Expand the array to a full array
      for (var k =0; k < rowIArray.length; k++) {
        var ki = rowIArray[k];
        fullRowArray[ki] = rowXArray[k];
      }

      // Slice to only get requested entries
      // TODO: This can be optimised so that only values that are needed to begin with
      // are stored. This can be done with an if in the inner loop, that check the ki index
      // for being in range and offsetting as required
      var retVal = fullRowArray.slice(cellIndexStart,cellIndexEnd);

      // Done, do the callback
      callback(geneName, geneindex, retVal);
    });
  });
};

/**
 * Performs the getExpressionValuesSparseByCellIndexUnpacked
 * @description this is to be called by the object only as it assumes that
 * the correct initialisation is done
 * @private
 */
DataControllerFile.prototype.getExpressionValuesSparseByCellIndexUnpackedInternal =
  function(geneIds, cellIndexStart, cellIndexEnd, getCellNames, callback){

  var dcf = this;
  var fr = this.formatReader;

  // Array to track progress of row generation with the async calls
  // Each request corresponds to the gene index
  var progressArray = new Uint32Array(geneIds.length);

  // The array to store the results as they come back
  var resultsArray = [];

  // Check if all tasks are done and call backback if so
  function checkIfDone(callback) {
    var done = true;
    for(var i = 0; i < progressArray.length; i++) {
      if (progressArray[i] !==  1) {
        done = false;
        break;
      }
    }
    if (done) {
      if(typeof callback === 'function') {
        callback();
      }
    }
  };

  // Runs when all the data is available
  function handleComplete(callback, dcf, cellIndexStart, cellIndexEnd) {
        // Convert to sparse matrix and return to callback
        var x = new Array();
        var i = new Array();
        var p = new Array()

        var dim1Length = resultsArray.length;
        var dim2Length = resultsArray[0].length;

        // Pack the subsetted array back into a sparse array
        // That the downstream functions expect
        var pos = 0;
        for (var k = 0; k < dim1Length; k++) {
          p.push(pos); // Start of the column
          for (var j =0; j < dim2Length; j++) {
              if (resultsArray[k][j] != 0) { // TODO: perhaps 1e-16
                x.push(resultsArray[k][j]); // The value
                i.push(j); // corresponding index j or K?
                pos++;
              }
          }
        }
        p.push(pos); // p push number of elements

        // TODO: consider converting the arrays to typed

        var cellNames = dcf.sparseArrayPreloadInfo.dimnames1Data.slice(cellIndexStart, cellIndexEnd);
        var retVal = new dgCMatrixReader(i, p , [dim2Length,dim1Length], cellNames, geneIds, x, null);

        // Done, do callback
        callback(retVal);
  }

  // Initiate callbacks for each row
  for(var geneIndexInRequest in geneIds) {
    var geneName = geneIds[geneIndexInRequest];
    dcf.getGeneColumn(geneName, geneIndexInRequest, cellIndexStart, cellIndexEnd, function(genename, geneindex, row) {
      progressArray[geneindex] = 1;
      resultsArray[geneindex] = row;
      checkIfDone(function(){
        handleComplete(callback, dcf, cellIndexStart, cellIndexEnd);
      }); // checkIfDone
    }); // getGeneColumn
  } // for each gene
}; // getExpressionValuesSparseByCellIndexUnpackedInternal

/**
 * Gets the expression values sparse
 *
 */
DataControllerFile.prototype.getExpressionValuesSparseByCellIndexUnpacked =
  function(geneIds, cellIndexStart, cellIndexEnd, getCellNames, callback){

    var dcf = this;

    if(this.sparseArrayPreloadInfo === null) {
      // Need to preload
      var dcf = this;
      this.getSparseArrayPreloadInformation('sparseMatrix', 'sparseArrayPreloadInfo', function() {
        dcf.getExpressionValuesSparseByCellIndexUnpackedInternal(geneIds, cellIndexStart, cellIndexEnd, getCellNames, callback);
      })
    } else {
      dcf.getExpressionValuesSparseByCellIndexUnpackedInternal(geneIds, cellIndexStart, cellIndexEnd, getCellNames, callback);
    }
};

/**
 * Helper function that returns the length of a null terminated string
 */
DataControllerFile.prototype.getNullTerminatedStringLength = function(text) {
  		var dataLength = 0;
  		var textLength = text.length;
  		for (; dataLength < textLength; dataLength++) {
  		    if (text.charCodeAt(dataLength) === 0) {
  			    break;
  		    }
  		}
  		return dataLength;
};

/**
 * Get the available embeddings for a reduction
 */
DataControllerFile.prototype.getAvailableEmbeddings = function(type, callback, callbackParams) {
  this.getEmbeddingStructure(function(data) {
    var ret = [];
    for(var i in data[type]) {
      ret.push(i);
    }
    callback(ret, callbackParams);
  });
};

/**
 * Implements getAspectMatrixByAspect
 */
DataControllerFile.prototype.getAspectMatrixByAspect = function(cellIndexStart, cellIndexEnd, aspectIds, callback) {
  // Adapter for data formats
  this.getAspectMatrixByAspectInternal(cellIndexStart, cellIndexEnd, aspectIds, function(data){callback(data.getFullMatrix())});
};

/**
 * Implements getAspectMatrix
 */
DataControllerFile.prototype.getAspectMatrix = function(cellIndexStart, cellIndexEnd, getCellNames, callback) {
  // Get all aspect names and call getAspectMatrixByAspectInternal with the aspect names
  var dcf = this;

  var handleComplete = function() {
    var aspectIds = Object.keys(dcf.aspectInformation);
    dcf.getAspectMatrixByAspectInternal(cellIndexStart, cellIndexEnd, aspectIds, callback);
  };

  if (dcf.aspectInformation === null) {
    this.loadAspectInformation(handleComplete);
  } else {
    handleComplete();
  }
};

/**
 * Internal implementeation of getAspectMatrix (full or by aspect)
 * @private
 * @description checks that the preload data exists and calls getAspectMatrixByAspectInternal2
 */
DataControllerFile.prototype.getAspectMatrixByAspectInternal = function(cellIndexStart, cellIndexEnd, aspectIds, callback) {
    var dcf = this;

    // Check if we have the preload data
    if(this.aspectArrayPreloadInfo === null) {
      // Need to preload
      this.getSparseArrayPreloadInformation('aspectMatrix','aspectArrayPreloadInfo', function() {
        dcf.getAspectMatrixByAspectInternal2(cellIndexStart, cellIndexEnd, aspectIds, callback);
      })
    } else {
      dcf.getAspectMatrixByAspectInternal2(cellIndexStart, cellIndexEnd, aspectIds, callback);
    }
};

/**
 * Second level internal function that does the job
 * @private
 */
DataControllerFile.prototype.getAspectMatrixByAspectInternal2 = function(cellIndexStart, cellIndexEnd, aspectIds, callback) {
  var dcf = this;
  var fr = this.formatReader;

  // Array to track progress of row generation
  var progressArray = new Uint32Array(aspectIds.length);

  var resultsArray = [];

  function checkIfDone(callback) {
    var done = true;
    for (var i = 0; i < progressArray.length; i++){
      if (progressArray[i] !== 1) {
        done = false;
        break;
      }
    }
    if (done) {
      if (typeof callback === 'function') {
        callback();
      }
    }
  };

  function handleComplete(callback, dcf, cellIndexStart, cellIndexEnd) {
    // convert back to sparse matrix and return to callback
     var x = new Array();
     var i = new Array();
     var p = new Array();

     var dim1Length = resultsArray.length;
     var dim2Length = resultsArray[0].length; // From first elements

     var pos = 0;
     for (var k = 0; k < dim1Length; k++) {
       p.push(pos); // column start
       for (var j = 0; j < dim2Length; j++) {
         if (resultsArray[k][j] != 0) {
           x.push(resultsArray[k][j]);
           i.push(j);
           pos++;
         }
       }
     }
     p.push(pos);

     var cellNames = dcf.aspectArrayPreloadInfo.dimnames1Data.slice(cellIndexStart, cellIndexEnd);
     var retVal = new dgCMatrixReader(i, p, [dim2Length, dim1Length], cellNames, aspectIds, x, null);

     callback(retVal);

  }

  var aspectColumnCallback = function(genename, aspectindex, row) {
      progressArray[aspectindex] = 1;
      resultsArray[aspectindex] = row;
      checkIfDone(function() {
        handleComplete(callback, dcf, cellIndexStart, cellIndexEnd);
      });
  };

  // Initiate callbacks for each row
  for (var aspectIndexInRequest in aspectIds) {
    var aspectName = aspectIds[aspectIndexInRequest];
    dcf.getAspectColumn(aspectName, aspectIndexInRequest, cellIndexStart, cellIndexEnd, aspectColumnCallback);
  } // for each aspect
}; //getAspectMatrixByAspectInternal2

DataControllerFile.prototype.getAspectColumn = function(aspectName, aspectindex, cellIndexStart, cellIndexEnd, callback) {
  var dcf = this;
  var fr = this.formatReader;

  //Index of the aspect
  var aspectIndexInSparse = dcf.aspectArrayPreloadInfo.dimnames2DataReverse[aspectName];

  //Column start and end index
  var csi = dcf.aspectArrayPreloadInfo.parray[aspectIndexInSparse] -1;
  var cei = dcf.aspectArrayPreloadInfo.parray[aspectIndexInSparse + 1] - 1;

  // Zero filled array with data for all cells
  var fullRowArray = new Float32Array(dcf.aspectArrayPreloadInfo.dim1);

  const BYTES_PER_FLOAT32 = 4;
  var xArrayOffset = dcf.aspectArrayPreloadInfo.xStartOffset + BYTES_PER_FLOAT32;

  // Byte position in the file that corresponds to the csi and cei indexes
  var csiBytes = xArrayOffset + csi * BYTES_PER_FLOAT32;
  var ceiBytes = xArrayOffset + cei * BYTES_PER_FLOAT32;

  // Get the number of bytes to retrieve
  var xRowLength = ceiBytes - csiBytes;

  // get the x array bytes
  fr.getBytesInEntry('aspectMatrix', csiBytes, xRowLength, function(buffer) {
    var aspectIndexInRequest = aspectIndexInRequest;
    var rowXArray = new Float32Array(buffer);

    // Calculate positions of i array entries in the file
    var iArrayOffset = dcf.aspectArrayPreloadInfo.iStartOffset + BYTES_PER_FLOAT32;
    var csiBytesI = iArrayOffset + csi * BYTES_PER_FLOAT32;
    var ceiBytesI = iArrayOffset + cei * BYTES_PER_FLOAT32;
    var xRowLengthI = ceiBytes - csiBytes;

    // Get the p array bytes
    fr.getBytesInEntry('aspectMatrix', csiBytesI, xRowLengthI, function(buffer2) {
      var rowIArray = new Uint32Array(buffer2);

      for (var k = 0; k < rowIArray.length; k++) {
        var ki = rowIArray[k];
        fullRowArray[ki] = rowXArray[k];
      }

      // TODO can avoid the slice in principle
      var retVal = fullRowArray.slice(cellIndexStart, cellIndexEnd);

      // Done, do the callback
      callback(aspectName, aspectindex, retVal);
    })
  });
};  // getAspectColumn

/**
 * Loads the aspect information
 * the information includes the names of the availbale aspects
 * and the genesets contained in each of them along with some
 * information values
 */
DataControllerFile.prototype.loadAspectInformation = function(callback) {
  // FIXME: Assume format reader is ready here
  var fr = this.formatReader;
  var dcf = this;

  var fn = function() {
        fr.getEntryAsText('aspectinformation', function(text) {
          var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      		var textTrimmed = text.slice(0, dataLength);
      		dcf.aspectInformation = JSON.parse(textTrimmed)
      		callback();
  	 }, fr);
  };

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
};

/**
 * Implements getAvailableAspectsStore
 */
DataControllerFile.prototype.getAvailableAspectsStore = function(callback) {
  var dcf = this;

  var handleComplete = function() {
    var data = Object.keys(dcf.aspectInformation);

        // Data needs to be converted into an array
        // of objects with named properties
        var dataStructured = [];
        for (var i = 0; i < data.length; i++) {
          dataStructured[i] = {'name': data[i]}
        };

	      var pagingStore = Ext.create('LocalJsonStore', {
	        autoLoad: true,
	        model: 'aspectTableEntry',
	        pageSize: 20,
	        localData: dataStructured
	      });
	      callback(pagingStore);
  };

  if (dcf.aspectInformation === null) {
    this.loadAspectInformation(handleComplete);
  } else {
    handleComplete();
  }
};

/**
 * Implements getAvailableGenesetsInAspectStore
 */
DataControllerFile.prototype.getAvailableGenesetsInAspectStore = function(aspectId, callback) {
  var dcf = this;

  var handleComplete = function() {
    var data = dcf.aspectInformation[aspectId];

      var pagingStore = Ext.create('LocalJsonStore', {
        autoLoad: true,
        model: 'genesetInAspectEntry',
        pageSize: 100,
        localData: data
      });

      callback(pagingStore);
  };

  if (dcf.aspectInformation === null) {
    this.loadAspectInformation(handleComplete);
  } else {
    handleComplete();
  }
};


/**
 * Get gene information store
 */
DataControllerFile.prototype.getGeneSetInformationStore = function(callback) {
  var fr = this.formatReader;
  var dcf = this;

  var fn = function() {
        fr.getEntryAsText('genesets', function(text) {
          var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      		var textTrimmed = text.slice(0, dataLength);
      		var data = JSON.parse(textTrimmed);

        	var pagingStore = Ext.create('LocalJsonStore', {
        		autoLoad: true,
        		model: 'geneSetTableEntry',
        		pageSize: 100,
        		localData: data
    	    });
    	    callback(pagingStore);

  	 }, fr);
  };

  // Call immediately or defer to when the object is ready
  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
}

/**
 * Generates, caches and returns via callback a map of genenames to entries that will be returned
 * by getGeneSetStoreByName
 */
DataControllerFile.prototype.getGeneInformationMap = function(callback) {
  var fr = this.formatReader;
  var dcf = this;

  // Check if we already have the result
  if (dcf.geneInformationMapCache === null) {

    fr.getEntryAsText('geneinformation', function(text) {
      var geneInformationDataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      var geneInformationTextTrimmed = text.slice(0, geneInformationDataLength);

      var geneInformationMap = {};
      var geneInformationData = JSON.parse(geneInformationTextTrimmed);

      for (var j = 0; j < geneInformationData.length; j++){
        var u = geneInformationData[j];

        if (typeof u !== 'undefined') { // This happens if the gene doesn't exist
          var t = {};
          t.genename = u.genename;
          t.dispersion = parseFloat(u.dispersion);
          t.score = 0; // Not using this at the moment

          geneInformationMap[u.genename] = t;
        }
      }
      dcf.geneInformationMapCache = geneInformationMap;
      callback(geneInformationMap);
    });

  } else {
    callback(this.geneInformationMapCache);
  }
};


/**
 * Implement getGeneSetStoreByName
 */
DataControllerFile.prototype.getGeneSetStoreByName = function(name, callback) {
  var fr = this.formatReader;
  var dcf = this;

  var fn = function() {
    fr.getEntryAsText('genesetsgenes', function(text) {
          var dataLength = DataControllerFile.prototype.getNullTerminatedStringLength(text);
      		var textTrimmed = text.slice(0, dataLength);
      		var data = JSON.parse(textTrimmed);

          if (Object.keys(data).indexOf(name) !== -1) {
            var curGeneSet = data[name];

            dcf.getGeneInformationMap(function(geneInformationMap) {

              // Holder for the return value object
              var retVal = [];

              // For each gene set
              for (var i = 0; i < curGeneSet.length; i++) {
                // Look up the constituent genes and append variance and mean information
                var curGeneName = curGeneSet[i];
                var p = geneInformationMap[curGeneName];
                if (typeof p !== 'undefined') {
                  retVal.push(p);
                }
              }

        	    var pagingStore = Ext.create('LocalJsonStore', {
            		autoLoad: true,
            		model: 'geneTableEntry',
            		pageSize: 100,
            		localData: retVal
        	    });

        	    callback(pagingStore);
            });

          } else {
            console.error('Geneset: ', name, ' does not exist.');
          }
    }, fr);
  }

  if (fr.state == fr.READY) {
    fn();
  } else {
    fr.addEventListener('onready',fn);
  }
}



