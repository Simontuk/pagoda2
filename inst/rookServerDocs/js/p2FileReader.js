"use strict";

/**
 * Pagoda2 file local or remote reader
 * @description Provides the abstration layer to allow transparently reading
 * arbitrary ranges from local or remote files
 * @argument opt_Type type of reader: 'local' or 'remote'
 * @argument opt_Url URL of the file to read for remote requests, null otherwise
 * @argument opt_File File object to read for local requests, null otherwise
 * @constructor
 */
function p2FileReader(opt_Type, opt_Url, opt_File) {
    this.internalReader  = null;

    if (opt_Type === 'local') {
    	if (typeof opt_File === 'undefined') {
    	    throw new Error('p2FileReader type is local and file is undefined');
    	} else {
    	    this.internalReader = new LocalFileReader(opt_File);
    	}
    } else if ( opt_Type === 'remote' ) {
    	if (typeof url === 'undefined' || url === '') {
    	    this.internalReader = new RemoteFileReader(opt_Url);
    	}
    } else {
	    throw new Error('Unknown p2FileReader type: ', opt_Type);
    }
}

/**
 * Read range of specified file
 * @description transparently reads local or remote files
 * @start start position, 0-indexed
 * @end end position, 0-indexed but not read
 * @callback the callback function
 */
p2FileReader.prototype.readRange = function(start, end, callback) {
    this.internalReader.readRange(start,end, callback);
}


p2FileReader.prototype.readRangeAsText = function(start, end, callback) {
    this.internalReader.readRangeAsText(start,end, callback);
}
