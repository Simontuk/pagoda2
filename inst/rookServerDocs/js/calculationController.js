"use strict";

/**
 * Perform compulations on the data
 * @constructor
 */
function calculationController(localAvailable, remoteAvailable) {
    if ( typeof calculationController.instance === 'object' ){
	    return calculationController.instance;
    };

    // TODO: Don't hard-code these
    this.methods = [
      {
        name: 'remoteDefault',
        displayName: 'Remote Default',
        help: 'Remote Default Method',
        repos: 'remote'
      }
    /*  ,
      {
        name: 'localDefault',
        displayName: 'Local Default',
        help: 'Local default method',
        repos: 'T-test'
      } */
    ];

    calculationController.instance = this;
    return this;
}

/**
 * Calculate differential expression between two cell sets
 * given a specific (local or remote method)
 */
calculationController.prototype.calculateDEfor2selections = function(selectionA, selectionB, method, callback) {
  if (method === 'remoteDefault') {
    return this.calculateDEfor2selectionsbyRemote(selectionA, selectionB, callback);
  } else {
    callback('Not implemented');
  }
}


/**
 * Calculate differential expression between one cell set and everything else
 * given a specific (local or remote method)
 */
calculationController.prototype.calculateDEfor1selection = function(selectionA, method, callback) {
  if (method === 'remoteDefault') {
    return this.calculateDEfor1selectionbyRemote(selectionA, callback);
  } else {
    callback('Not implemented');
  }
}


calculationController.prototype.calculateDEfor1selectionbyRemote = function(selectionA, callback) {
  var cellSelCntr = new cellSelectionController();
  var selAcells = cellSelCntr.getSelection(selectionA);

  // Alot of cell identifiers to send, send by POST
	var ajaxObj = $.ajax({
	    type: "POST",
	    dataType: 'json',
	    data: {
	      "compidentifier": "doDifferentialExpression1selection",
	      "selectionA": Ext.util.JSON.encode(selAcells)
	    },
	    url: "doComputation.php?compidentifier=doDifferentialExpression1selection",
	    startTime: new Date(),
	    success: function(data) {
		    callback(data,this.startTime);
	    }
	});

	return ajaxObj;
}

/**
 * Calculate differential expression between two groups of cells via connection to a remote server
 * @param selectionA the name of the first cell selection as registered in the cell selection controller
 * @param selectionB the name of the second cell selection as registered in the cell selection controller
 */
calculationController.prototype.calculateDEfor2selectionsbyRemote = function(selectionA, selectionB, callback) {
  var cellSelCntr = new cellSelectionController();
  var selAcells = cellSelCntr.getSelection(selectionA);
  var selBcells = cellSelCntr.getSelection(selectionB);
  // Alot of cell identifiers to send, send by POST
	var ajaxObj =  $.ajax({
	    type: "POST",
	    dataType: 'json',
	    data: {
	      "compidentifier": "doDifferentialExpression2selections",
	      "selectionA": Ext.util.JSON.encode(selAcells),
	      "selectionB": Ext.util.JSON.encode(selBcells),
	    },
	    url: "doComputation.php?compidentifier=doDifferentialExpression2selections",
	    startTime: new Date(),
	    success: function(data) {
		    callback(data,this.startTime);
	    }
	});

	return ajaxObj;
}

/**
 * Return the methods that are available for performing DE
 */
calculationController.prototype.getAvailableDEmethods = function() {
  return this.methods;
}


//////////////////////////////////////////

// TODO: Split this object to a new file

/**
 * Stores differential expression results and accompanying metadata
 * Singleton
 * @constructor
 */
function differentialExpressionStore() {
    if ( typeof differentialExpressionStore.instance === 'object' ){
	    return differentialExpressionStore.instance;
    };

    this.deSets = new Object();

    differentialExpressionStore.instance = this;
    return this;
};

/**
 * Get all available differential expression sets
 */
differentialExpressionStore.prototype.getAvailableDEsets = function() {
  var result = new Array();
  var availKeys = Object.keys(this.deSets);

  // Push key/display name pairs on an array
  for (var i = 0; i < availKeys.length; i++) {
    var curKey = availKeys[i];
    var name = curKey;
    var displayName = this.deSets[curKey].getName();
    
    var date = this.deSets[curKey].getStartTime().valueOf();
    result.push({'name': name, 'date': date, 'displayName': displayName});
  }
  return result;
};

/**
 * Get a de result by internal name
 */
differentialExpressionStore.prototype.getResultSetByInternalName = function(internalName) {
  //TODO: Implement some checks here
  return this.deSets[internalName];
}


/**
 * Add differential expression result to the store
 */
differentialExpressionStore.prototype.addResultSet = function(deset) {
  var newid = this.getUniqueId();
  this.deSets[newid] = deset;
  return newid;
};


/**
 * Generate a unique identifier for a de set
 * @private
 */
differentialExpressionStore.prototype.getUniqueId = function() {
  var dobj = new Date();
  var r = Math.floor(Math.random() * 1e12);
  var d = dobj.getTime();
  return  'deset_' +  d + '_' + r
}


///////////////////////////////
// TODO: Split this object into a new file

/**
 * Represents a differential expression result set and accompanying metadata
 * @constructor
 */
function deResultSet() {
  this.selectionA = null;
  this.selectionB = null;
  this.results = null;
  this.name = null;
  this.startTime = null;
  this.endTime = null;
};


/**
 * get the name
 */
deResultSet.prototype.getName = function() {
  return this.name;
};

/**
 * set the name
 */
deResultSet.prototype.setName = function(val) {
  this.name = val;
};

/**
 * get the startTime
 */
deResultSet.prototype.getStartTime = function() {
  return this.startTime;
};

/**
 * set the startTime
 */
deResultSet.prototype.setStartTime = function(val) {
  this.startTime = val;
};

/**
 * get the endTime
 */
deResultSet.prototype.getEndTime = function() {
  return this.endTime;
};

/**
 * set the endTime
 */
deResultSet.prototype.setEndTime = function(val) {
  this.endTime = val;
};


/**
 * Get the first cell selection (an array of cell ids)
 */
deResultSet.prototype.getSelectionA = function() {
  return this.selectionA;
};

/**
 * Set the first cell selection (an array of cell ids)
 */
deResultSet.prototype.setSelectionA = function(val) {
  this.selectionA = val;
};

/**
 * Set the second cell selection (an array of cell ids)
 */
deResultSet.prototype.getSelectionB = function() {
  return this.selectionB;
};


/**
 * Get the second cell selection (an array of cell ids)
 */
deResultSet.prototype.setSelectionB = function(val) {
  this.selectionB = val;
};


/**
 * Get the table of results
 */
deResultSet.prototype.getResults = function() {
  return this.results;
};


/**
 * Set the table of results
 */
deResultSet.prototype.setResults = function(val) {
  this.results = val;
};

