"use strict";

/*
 * Filename: actionPanelUIcontroller.js
 * Author: Nikolas Barkas
 * Date: May 2017
 */


/**
 * Manages the action panel interface. Singleton
 * @constructor
 */
function actionPanelUIcontroller() {
    if (typeof actionPanelUIcontroller.instance === 'object') {
	return actionPanelUIcontroller.instance;
    }

    this.generateCellSelectionStore();
    this.generateUI();

    // Setup listener for selection change
    var evtBus = new eventBus();
    evtBus.register("cell-selection-updated", null, function() {
	    var actPaneUICntr = new actionPanelUIcontroller();
	    actPaneUICntr.syncCellSelectionStore();
    });


    this.currentDErequest = null;
    actionPanelUIcontroller.instance = this;

};


/**
 * Generate the UI controls
 * @private
 */
actionPanelUIcontroller.prototype.generateUI = function() {
    var actionsTab = Ext.getCmp('actions-ui-tab');
    var UIcontroller = this;

    var actionsInnerTab = Ext.create('Ext.TabPanel', {
	layout: 'fit',
	width: '100%',
	height: '100%',
	tabBarPosition: 'top',
	items: [
	    {
		layout: 'fit',
		title: 'Differential Expression',
		id: 'differentialExpressionTab',
		glyph: 0xf14e, //fa-compass
		tooltip: 'Perform differential expression between two groups of cells',
		height: '100%',
		width: '100%',
	    },
	    {
		layout: 'fit',
		title: 'Gene to Gene Expression',
		id: 'expressionScatterPlotTab',
		glyph: 0xf192, //fa-dot-in-circle
		tooltip: 'Perform differential expression between two genes in one group of cells',
		height: '100%',
		width: '100%',
	    }
	    /*,
	    {
		layout: 'fit',
		title: 'Enrichment',
		glyph: 0xf200, // pie chart
		tooltip: 'Perform enrichment analysis',
		height: '100%',
		width: '100%'
	    } */
	]
    });

    // Data store for the available diff expr methods
    var deMethodsStore = Ext.create('Ext.data.Store', {
	id: 'availableDEmethodStore',
	fields: [{name: 'name', type: 'string'},
	       {name:'displayname', type: 'string'}]
    });

    // Populate the store
    var calcCntr = new calculationController();
    var availableMethods = calcCntr.getAvailableDEmethods();


    for (var i in availableMethods) {
	    deMethodsStore.add({name: availableMethods[i].name, displayname: availableMethods[i].displayName});
    }

    var deTab = Ext.getCmp('differentialExpressionTab');
    var espTab = Ext.getCmp('expressionScatterPlotTab');
    var formPanelDE =  Ext.create('Ext.form.Panel', {
    	id: 'formPanelDE',
    	height: '100%',
    	width: '100%',
    	bodyPadding: 10,
    	items: [
        {
          xtype: 'radiogroup',
          name: 'analysisType',
          fieldLabel: 'Analysis Type',
          items: [
            {
              boxLabel: 'Selection vs Selection',
              name: 'analysisTypeSelection',
              inputValue: 'vsSelection',
              checked: true
            },
            {
              boxLabel: 'Selection vs Background',
              name: 'analysisTypeSelection',
              inputValue: 'vsBackground'
            }
          ],

          listeners: {
            change: function(obj, newValue, oldValue, eOpts) {
              var selectionBcontrol = Ext.getCmp('selectionB');
              //debugger;
              if (newValue.analysisTypeSelection == 'vsSelection') {
                selectionBcontrol.enable();
              } else if (newValue.analysisTypeSelection == 'vsBackground') {
                selectionBcontrol.disable();
              } else {
                //Something is wrong
              }
            }
          }
        },
    	  {
    	    id: 'selectionA',
    	    xtype: 'combo',
    	    fieldLabel: 'Main Cell Selection',
    	    queryMode: 'local',
    	    editable: false,
    	    store: Ext.data.StoreManager.lookup('cellSelectionStoreForDE'),
    	    displayField: 'displayname',
    	    valueField: 'selectionname'
    	},
    	{
    	    id: 'selectionB',
    	    xtype: 'combo',
    	    fieldLabel: 'Reference Cell Selection',
    	    queryMode: 'local',
    	    editable: false,
    	    store: Ext.data.StoreManager.lookup('cellSelectionStoreForDE'),
    	    displayField: 'displayname',
    	    valueField: 'selectionname'
    	},{
    	    id: 'selectionMethod',
    	    xtype: 'combo',
    	    fieldLabel: 'Method', // TODO add help pane
    	    queryMode: 'local',
    	    editable: false,
    	    store: Ext.data.StoreManager.lookup('availableDEmethodStore'),
    	    displayField: 'displayname',
    	    valueField: 'name'
    	},{
    	  id: 'resultName',
    	  xtype: 'textfield',
    	  fieldLabel: 'Name for results'
    	},{
    	    xtype: 'button',
    	    text: 'Run differential expression',
    	    name: 'runDEbutton',
    	    id: 'runDEbutton',
    	    handler: UIcontroller.runAnalysisClickHandler
    	},
    	{
    	  xtype: 'button',
    	  text: 'Stop',
    	  name: 'stopDEbutton',
    	  id: 'stopDEbutton',
    	  handler: UIcontroller.stopAnalysisClickHandler,
    	  disabled: true
    	},
    	{
    	  xtype: 'button',
    	  glyph: 0xf128,
    	  text: 'Help',
    	  handler: UIcontroller.showDEhelpDialog
    	}



    	] //items
    });
    
    //Gene expression scatter chart
    var formPanelESP =  Ext.create('Ext.form.Panel', {
    	id: 'formPanelESP',
    	height: '100%',
    	width: '100%',
    	bodyPadding: 10,
    	items: [
    	  {
          xtype: 'radiogroup',
          name: 'analysisType',
          fieldLabel: 'Analysis Type',
          items: [
            {
              boxLabel: 'Against Selection',
              name: 'analysisTypeSelection',
              inputValue: 'vsSelection',
              disabled: true
            },
            {
              boxLabel: 'Against All Cells',
              name: 'analysisTypeSelection',
              inputValue: 'vsBackground',
              checked: true
            }
          ],

          listeners: {
            change: function(obj, newValue, oldValue, eOpts) {
              var selectionControl = Ext.getCmp('cellSelectionESP');
              //debugger;
              if (newValue.analysisTypeSelection == 'vsSelection') {
                selectionControl.enable();
              } else if (newValue.analysisTypeSelection == 'vsBackground') {
                selectionControl.disable();
              } else {
                //Something is wrong
              }
            }
          }
        },
    	  {
    	    id: 'cellSelectionESP',
    	    xtype: 'combo',
    	    fieldLabel: 'Reference Cell Selection',
    	    queryMode: 'local',
    	    editable: false,
    	    store: Ext.data.StoreManager.lookup('cellSelectionStoreForDE'),
    	    displayField: 'displayname',
    	    valueField: 'selectionname',
    	    disabled: true
    	  },
    	  {
    	    xtype: 'textfield',
    	    id: 'geneA',
    	    fieldLabel: "Gene A",
    	  },
    	  {
    	    xtype: 'textfield',
    	    id: 'geneB',
    	    fieldLabel: "Gene B",
    	  },
    	  {
    	    xtype: 'button',
    	    text: 'Build Plot',
    	    margin: '5 5 5 5',
    	    handler: UIcontroller.generateESPwindow
    	  },
    	  {
    	    xtype: 'button',
    	    glyph: 0xf128,
    	    text: 'help',
    	    margin: '5 5 5 5',
    	    handler: UIcontroller.showESPhelpDialog
    	  }
    	]
    });
    
    deTab.add(formPanelDE);
    espTab.add(formPanelESP);
    actionsTab.add(actionsInnerTab);
};


/**
 * Disable the run button (and enable the stop button) for de analysis
 */
actionPanelUIcontroller.prototype.disableRunButton = function() {
  var form = Ext.getCmp("formPanelDE").getForm();
  var button = Ext.getCmp('runDEbutton');
  button.setText('Please wait...');
  button.disable();

  var stopButton = Ext.getCmp('stopDEbutton');
  stopButton.enable();

}

/**
 * Enable the run button (and disable the stop button) for de analysis
 */
actionPanelUIcontroller.prototype.enableRunButton = function() {
  var form = Ext.getCmp("formPanelDE").getForm();
  var button = Ext.getCmp('runDEbutton');
  button.setText('Run differential expression...');
  button.enable();

  var stopButton = Ext.getCmp('stopDEbutton');
  stopButton.disable();
}



/**
 * Show help dialog for differential analysis
 */
actionPanelUIcontroller.prototype.showDEhelpDialog = function() {
    Ext.create('Ext.window.Window', {
      height: 300,
      width: 400,
      title: 'Help: Differential expression',
      scrollable: true,
      bodyPadding: 10,
      html: '<h2>Running differential expression</h2>' +
        '<p>You can use this form to run differential expression in two different modes: \'Selection vs Selection\' or \'Selection vs Background\'. In both cases your results will be displayed on the right hand column under the \'Differential Expression\' panel.</p>' +
        '\'Selection vs Selection\' will compare two gene selections specified. To run this type of differential expression you will need to have specified two different cells groups. You can do that in several ways. Cell selections can be defined in the embedding by drag selecting, in the dendrogram (see the dendrogram help for more details) and in the metadata by selecting all cells in a particular cluster. Your cell selections are available in the \'Cell selection\' panel which also allows you to highlight them to confirm their identity. In order to run differential expression select cell selections to compare using the drop down menus and then select the method you want to use. Methods can either be local (run in the browser) or remote (run in the supporting server). Finally enter a name for your selection and click on \'Run differential expression\'. After a short wait your results will appear in the right hand panel.</p>' +
        '<p>In the \'Selection vs Background\' mode you can perform differntial expression between one cell selection and everything else. This is identify genes that are highly expressed in your selection but not other cells. The procedure is similar to the one described above but does not require the selection of two cell sets.</p>',
      constrain: true,
      closable: true,
      resizable: false
    }).show();
    pagHelpers.regC(94);
}
/**
 * Show help dialog for Expression Scatter Plot
 */
actionPanelUIcontroller.prototype.showESPhelpDialog = function (){
  Ext.create('Ext.window.Window', {
      height: 300,
      width: 400,
      title: 'Help: Expression Scatter Plots',
      scrollable: true,
      bodyPadding: 10,
      html: '<h2>Plotting differential expression of two genes in a cell selection</h2>' +
        '<p></p>'
        ,
      constrain: true,
      closable: true,
      resizable: false
    }).show();
}

/**
 * Generates an ESP window if the data provided on the ESP tab is valid 
 */
actionPanelUIcontroller.prototype.generateESPwindow = function(){
  var form = Ext.getCmp("formPanelESP").getForm();
  
  var cellSelection = form.findField("cellSelectionESP").getValue();
  var geneA = form.findField("geneA").getValue();
  var geneB = form.findField("geneB").getValue();
  
  if(geneA.length === 0){
    Ext.MessageBox.alert('Warning',"Please provide a gene in the Gene A field.");
  }
  else if(geneB.length === 0){
    Ext.MessageBox.alert('Warning',"Please provide a gene in the Gene B field.");
  }
  //else if(cellSelection === null){
  //  Ext.MessageBox.alert('Warning',"No Cell Selection Provided")
  //}
  else{
    (new dataController()).getExpressionValuesSparseByCellIndexUnpacked(Array(geneA,geneB),0,3000,false, function(data){
      
      if(data.DimNames2.length < 2){
        Ext.MessageBox.alert("Error", "One or more of the gene names provided could not be found in the provided dataset.");
        return;
      }
      
      var geneMatrix = data.getFullMatrix();
      Ext.create("Ext.window.Window", {
        resizeable: false,
        modal:true,
        items:[
          {
            html:'<canvas id="scatterChart" height="500" width="500"></canvas>'
          }
        ],
      }).show();
      
      
    })
  }
}
/**
 * Click handler for stop button of DE analysis
 * @private
 */
actionPanelUIcontroller.prototype.stopAnalysisClickHandler = function() {
 var actionUI = new actionPanelUIcontroller();
 actionUI.currentDErequest.abort();
 actionUI.currentDErequest = null;
 actionUI.enableRunButton();
}


/**
 * Click handler for run button of DE analysis
 * @private
 */
actionPanelUIcontroller.prototype.runAnalysisClickHandler = function() {

  var form = Ext.getCmp("formPanelDE").getForm();

  var analysisType = form.findField("analysisType").getValue();
  var selectionA = form.findField("selectionA").getValue();
  var selectionB = form.findField("selectionB").getValue();
  var method = form.findField('selectionMethod').getValue();
  var resultName = form.findField("resultName").getValue();

  if (method === null) {
        Ext.MessageBox.alert('Warning', 'Please enter a method for the differential expression',function(){});
  } else if (resultName === '') {
        Ext.MessageBox.alert('Warning', 'Please enter a name for the results',function(){});
  } else {
    if (analysisType.analysisTypeSelection == 'vsSelection') {
      if (selectionA === selectionB) {
          Ext.MessageBox.alert('Warning', 'Please select a different set for A and B');
      } else {

          var actionUI = new actionPanelUIcontroller();
          actionUI.disableRunButton();

          var calcCntr = new calculationController();

          actionUI.currentDErequest = calcCntr.calculateDEfor2selections(selectionA, selectionB, 'remoteDefault',  function(results,start) {
            actionUI.enableRunButton();
              actionUI.currentDErequest = null;

              // Get the cell names in the selection for storing
              var cellSelCntr = new cellSelectionController();
              var selAcells = cellSelCntr.getSelection(selectionA);
              var selBcells = cellSelCntr.getSelection(selectionB);

              // Make a deResult set for saving the results
              // and save metadata related to this de result
              
              var end = new Date();
              var resultSet = new deResultSet();
              resultSet.setResults(results);
              resultSet.setName(resultName);
              resultSet.setSelectionA(selAcells);
              resultSet.setSelectionB(selBcells);
              resultSet.setStartTime(start);
              resultSet.setEndTime(end);
              // Save this de result set in the differentialExpresionStore
              var diffExprStore = new differentialExpressionStore();
              var setId = diffExprStore.addResultSet(resultSet);

              // Notify the DE results table to updata from the store
              var diffExpreTblView = new diffExprTableViewer();
              diffExpreTblView.update();

              diffExpreTblView.showSelectedSet(setId);

              // TODO: Change focus to the table and hightlight new de set
          } );
      }  // if .. else
    } else if (analysisType.analysisTypeSelection == 'vsBackground') {
          var actionUI = new actionPanelUIcontroller();
          actionUI.disableRunButton();
          var calcCntr = new calculationController();
          actionUI.currentDErequest = calcCntr.calculateDEfor1selection(selectionA, 'remoteDefault',  function(results,start) {
              actionUI.enableRunButton();
              actionUI.currentDErequest = null;
              // Get the cell names in the selection for storing
              var cellSelCntr = new cellSelectionController();
              var selAcells = cellSelCntr.getSelection(selectionA);

              // Make a deResult set for saving the results
              // and save metadata related to this de result
              var end = new Date();
              var resultSet = new deResultSet();
              resultSet.setResults(results);
              resultSet.setName(resultName);
              resultSet.setSelectionA(selAcells);
              resultSet.setStartTime(start);
              resultSet.setEndTime(end);
              // Save this de result set in the differentialExpresionStore
              var diffExprStore = new differentialExpressionStore();
              var setId = diffExprStore.addResultSet(resultSet);

              // Notify the DE results table to updata from the store
              var diffExpreTblView = new diffExprTableViewer();
              diffExpreTblView.update();

              diffExpreTblView.showSelectedSet(setId);
          } );
    } // else.. if
  }
} // runAnalysisClickHandler


/**
 * Generate the cell selection store for populating the dropdowns
 * @private
 */
actionPanelUIcontroller.prototype.generateCellSelectionStore = function() {
    Ext.create('Ext.data.Store', {
	storeId: 'cellSelectionStoreForDE',
	fields: [
		{ name: 'selectionname', type: 'string'},
		{ name: 'displayname', type: 'string'}
	],
	autoLoad: true
    });
}


/**
 * Update the cell selection store for populating the dropdowns
 * with information from the selection controller
 * @private
 */
actionPanelUIcontroller.prototype.syncCellSelectionStore = function() {
    // Get the store for the table and empty it
    var store = Ext.data.StoreManager.lookup('cellSelectionStoreForDE');
    store.removeAll();

    // Repopulate the store
    var cellSelCntr =  new cellSelectionController();
    var availSelections = cellSelCntr.getAvailableSelections();

    for (var sel in availSelections) {
    	var selName = availSelections[sel];
    	var selDisplayName =  cellSelCntr.getSelectionDisplayName(selName);

    	store.add({selectionname: selName, displayname: selDisplayName});
    }// for
}


function graphViewer(data, canvas){
      this.minX = 0;
      this.minY = 0;
      this.maxX = 0;
      this.maxY = 0;
      this.dataPoints = data;
      for(var i = 0; i < geneMatrix.array.length; i++){
        this.minX = Math.min(geneMatrix.array[i][0],minX);
        this.minY = Math.min(geneMatrix.array[i][1],minY);
        this.maxX = Math.max(geneMatrix.array[i][0],maxX);
        this.maxY = Math.max(geneMatrix.array[i][1],maxY);
      }
      this.targetCanvas = canvas;
}
graphViewer.prototype.drawScatterePlot = function(){
  
  var choices = {
    hasXscale: true,
    hasYscale: true,
    hasAxisLabels: true
  }
  this.measureComponents("14px Arial","28px Arial",500,500,2,5,{
    
  });
  
  
}
graphViewer.prototype.measureComponents = function(axisFont, titleFont, width, height, padding, margin, choices){
  var boundings = {}
  var ctx = this.targetCanvas.getContext('2d');
  
  var axisHeight = pagHelpers.getTextHeight(axisFont);
  boundings.xGutter = (choices.hasXscale? axisHeight + padding : 0) + (choices.hasAxisLabels? axisHeight + padding : 0) + margin;
  boundings.yGutter = margin + (choices.hasAxisLabels? axisHeight + padding : 0);
  if(choices.hasYscale){
    var step = (this.maxY-this.minY)/5
    ctx.font = axisFont;
    var maxLength = 0;
    for(var x = minY; x < this.maxY; x += step){maxLength = Math.max(ctx.measureText(x.toFixed(2)),maxLength)}
    boundings.yGutter += maxLength + padding;
  }
  
  var titleHeight = pagHelpers.getTextHeight(titleFont);
  boundings.topGutter = margin + (choices.hasTitle? titleHeight + padding: 0)
  boundings.rightGutter = margin;
  
  boundings.plotTL = {
    x: yGutter + graphViewer.linethickness,
    y: topGutter
  }
  boundings.plotBR = {
    x: width - rightGutter,
    y: height - xGutter - graphViewer.linethickness
  }
  boundings.plotDim = {
    width: width - rightGutter - yGutter - graphViewer.linethickness,
    height: height - topGutter - xGutter - graphViewer.linethickness
  }
  boundings.canvasDim = {
    height: height,
    width: width
  }
  
  return boundings;
}

graphViewer.prototype.drawAxis = function(options, boundings, yLabel, xLabel, padding, margin){
  var ctx = this.targetCanvas.getContext("2d");
  
  
  if(choices.hasYscale){
    ctx.textAlign = "right";
    ctx.textBaseline = "Middle";
    var scaleSpace = plotDim.height/5;
    var step = (this.maxY-this.minY)/5
    for(var i = 0; i < 6; i++){
      ctx.fillStyle = "#000000";
      ctx.fillText((minY+(i*step)).toFixed(2) + "", (plotTL.x - graphViewer.lineThickness - padding), plotBR.y - scaleSpace * i);
      ctx.fillStyle = "#D3D3D3";
      ctx.fillRect(graphTL.x, plotBR.y - scaleSpace * i, plotDim.width, graphViewer.lineThickness);
    }
  }
  
  if(choices.hasXscale){
    ctx.textAlign = "center";
    ctx.textBaseline = "Hanging";
    var scaleSpace = plotDim.width/5;
    var step = (this.maxX-this.minX)/5
    for(var i = 0; i < 6; i++){
      ctx.fillStyle = "#000000";
      ctx.fillText((minY+(i*step)).toFixed(2) + "", (plotTL.x - graphViewer.lineThickness - padding), plotBR.y - scaleSpace * i);
      ctx.fillStyle = "#D3D3D3";
      ctx.fillRect(graphTL.x + scaleSpace * i, plotBR.y, graphViewer.lineThickness, plotDim.height);
    }
  }
  
  if(choices.hasAxisLabels){

    ctx.textAlign = "center";
    ctx.textBaseline = "Bottom";
    ctx.fillText(xLabel, (plotBR.x - plotTL.x)/2, canvasDim.height - margin);

    ctx.textBaseline = "Hanging";
    targetContext.rotate(-Math.PI/2);
    ctx.fillText(yLabel,-(plotBR.y - plotTL.y)/2, margin)
    targetContext.rotate(Math.PI/2);
    
  }
  
  ctx.fillStyle = "#000000";
  ctx.fillRect(boundings.plotTL.x, boundings.plotTL.y, -1 * graphViewer.lineThickness, plotDim.height + graphViewer.lineThickness);
  ctx.fillRect(boundings.plotTL.x,boundings.plotBR.y, plotDim.width, graphViewer.lineThickness);
  
}
graphViewer.prototype.lineThickness = 1;


