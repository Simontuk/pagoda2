"use strict";

/**
 * Calculate differential expression between two groups of cells the Kologomorov Smirnov test
 * @param params A compound object containing data, and information passed to this worker from the event listener
 * @param geneData A sparse matrix containing the gene names being read in and the expression values
 */
function runKSonGroup(params, geneData){
      //for each gene calculate differential expression
      for(var gene = 0; gene < geneData.array[0].length; gene++){

        var selAexpr = [];
        var selBexpr = [];

        //retrieve expression data by indexes for selection A
        for(var cell = 0; cell < params.selAidx.length; cell++){
          selAexpr.push(geneData.array[params.selAidx[cell]][gene]);
        }
        //retrieve expression data by indexes for selection B
        for(var cell = 0; cell < params.selBidx.length; cell++){
          selBexpr.push(geneData.array[params.selBidx[cell]][gene]);
        }

        selAexpr.sort(function(x,y){return x-y});
        selBexpr.sort(function(x,y){return x-y});

        //remove all expression values of 0
        while(selAexpr.length >0 && selAexpr[0] === 0){
          selAexpr.shift();
        }
        while(selBexpr.length >0 && selBexpr[0] === 0){
          selBexpr.shift();
        }
        //do not analyze genes if the number of expression values is less than 10 in either selection
        if(selAexpr.length < 10 || selBexpr.length < 10){
          continue;
        }

        var d = 0; //current maximum distance between two curves
        var dSign = 0; //sign of the gene
        var totalA = 0; //sum of all expression values for selection A
        var totalB = 0; //sum of all expression values for selection B
        var pdfStepA = selAexpr.length; //length of expression values in selection A
        var pdfStepB = selBexpr.length; //length of expression values in selection B
        var firstX = Math.min(selAexpr[0], selBexpr[0]); //first X value in the PDF
        var prevX = firstX; // previous X value in PDF
        var curX = prevX;
        var currD = 0; // current distance for calculating integral of pdf difference
        var fold = 0; // fold calculated as average difference between PDFs

        //parse through each expression value of selection A and B to superimpose their PDFs onto each other
        while(selAexpr.length > 0 && selBexpr.length > 0){
          fold += (curX-prevX) * currD;
          prevX = curX;
          curX = Math.min(selAexpr[0], selBexpr[0]);

          //remove minimums of each selection's expression one at a time
          if(selAexpr[0] < selBexpr[0]){
            totalA += selAexpr.shift();
          } else if(selAexpr[0] > selBexpr[0]){
            totalB += selBexpr.shift();
          } else{
            while(selAexpr[0] === selBexpr[0]){
              totalA += selAexpr.shift();
              totalB += selBexpr.shift();
              if(selBexpr.length === 0 || selAexpr.length === 0){
                break;
              }
            }
          }
          currD = (1-(selBexpr.length/pdfStepB)) - (1-(selAexpr.length/pdfStepA));
          var instDSign = Math.sign(currD);
          var instD = Math.abs(currD);

          //replace current distance with highest magnitude distance
          if(instD > d){
            d = instD;
            dSign = instDSign;
          }

        }

        //remove rest of slection B if there is still some left and perform fold calculation
        if(selAexpr.length === 0){
          while(selBexpr.length > 0){
            fold += (curX-prevX) * currD;
            prevX = curX;
            curX = selBexpr.shift()
            currD = (1-(selBexpr.length/pdfStepB));
          }
        }
        //remove rest of slection B if there is still some left and perform fold calculation
        else if(selBexpr.length === 0){
          while(selAexpr.length > 0){
            fold += (curX-prevX) * currD;
            prevX = curX;
            curX = selAexpr.shift()
            currD = -(1-(selAexpr.length/pdfStepA));
          }
        }
        fold += (curX-prevX) * currD;


        var mean = Math.log(totalA/pdfStepA)-Math.log(totalB/pdfStepB);
        fold = Math.max(-1,Math.min(fold/(curX - firstX),1));
        var z = d * Math.sqrt(pdfStepA*pdfStepB/(pdfStepA+pdfStepB));
        //Checks for p < .05
        if(z >= 3.0){
          params.results.push({Z:(z*dSign), absZ:z, name: geneData.colnames[gene], fe: fold, M:mean, highest:(dSign >= 0)})
        }
      }
}

/**
 * Calculate differential expression between two groups of cells the Wilcoxon Mann-Whitney test
 * @param params A compound object containing data, and information passed to this worker from the event listener
 * @param geneData A sparse matrix containing the gene names being read in and the expression values
 */
function runWilcoxonOnGroup(params,geneData){

      //for each gene calculate differential expression
      for(var gene = 0; gene < geneData.array[0].length; gene++){

        var selAexpr = [];
        var selBexpr = [];

        //retrieve expression data by indexes for selection A
        for(var cell = 0; cell < params.selAidx.length; cell++){
          selAexpr.push(geneData.array[params.selAidx[cell]][gene]);
        }
        //retrieve expression data by indexes for selection B
        for(var cell = 0; cell < params.selBidx.length; cell++){
          selBexpr.push(geneData.array[params.selBidx[cell]][gene]);
        }

        selAexpr.sort(function(x,y){return x-y});
        selBexpr.sort(function(x,y){return x-y});

        //removes all selections with a value of 0
        while(selAexpr.length >0 && selAexpr[0] === 0){
          selAexpr.shift();
        }
        while(selBexpr.length >0 && selBexpr[0] === 0){
          selBexpr.shift();
        }

        //skips the gene if there aren't enough valid cells
        if(selAexpr.length < 10 || selBexpr.length < 10){
          continue;
        }

        var length = selAexpr.length;
        var lengthPrime = selBexpr.length;
        var index = 0;

        var totalArank = 0;
        var mean = 0;

        //calculates ranks for cell selection A by way of wilcoxon ranking
        for(var i = 0; i< selBexpr.length; i++){
          while(index < selAexpr.length && selAexpr[index] <= selBexpr[i]){
            if(selAexpr[index] === selBexpr[i]){
              totalArank += (i + .5)
            }
            else{
              totalArank += (i);
            }
            mean += selAexpr[index];
            index++;
          }
          mean += selBexpr[i];
        }
        for(; index < selAexpr.length; index++){
          totalArank += (selBexpr.length);
          mean += selAexpr[index];
        }
        mean = mean/(length + lengthPrime);

        //calculates total of B's ranks using A's rank and sample size
        var totalBrank = length * lengthPrime - totalArank;



        var fold = (totalBrank === 0? 1: Math.min(totalArank/totalBrank,1));

        var mu = (length * lengthPrime) / 2;
        var sigma = Math.sqrt((length * lengthPrime) * (length+ lengthPrime +1)/12);

        var z = Math.abs((Math.max(totalArank,totalBrank) - mu)/sigma);
        var zSign = (Math.max(totalBrank,totalArank) === totalArank ? 1 : -1);
        //accepts p < .05
        if(z >= 3.0){
          params.results.push({Z:(z*zSign), absZ:z, name: geneData.colnames[gene], fe: fold, M:mean, highest:(zSign >= 0)})
        }
      }
}

/*function runTtestOnGroup(params, geneData){
      //for each gene in the batch perform diff expr analysis
      for(var gene = 0; gene < geneData.array[0].length; gene++){

        var selAexpr = [];
        var selBexpr = [];
        //using the selection indecies of A to collect selection A expression values
        for(var cell = 0; cell < params.selAidx.length; cell++){
          selAexpr.push(geneData.array[params.selAidx[cell]][gene]);
        }
        //using the selection indecies of B to collect selection B expression values
        for(var cell = 0; cell < params.selBidx.length; cell++){
          selBexpr.push(geneData.array[params.selBidx[cell]][gene]);
        }

        selAexpr.sort(function(x,y){return x-y});
        selBexpr.sort(function(x,y){return x-y});

        //remove all cells whose expression is 0 from selection A
        while(selAexpr.length >0 && selAexpr[0] === 0){
          selAexpr.shift();
        }
        //remove all cells whose expression is 0 from selection B
        while(selBexpr.length >0 && selBexpr[0] === 0){
          selBexpr.shift();
        }
        //If there are less than 5 in selections A or B no significant data can be gathered
        if(selAexpr.length < 5 || selBexpr.length < 5){
          continue;
        }

        var lengthA = selAexpr.length;
        var lengthB = selBexpr.length;
        var meanOfA = 0;
        var meanOfB = 0;

        //Calculate mean expression of selection A
        for(var i = 0; i < lengthA; i++){
          meanOfA += selAexpr[i];
        }
        //Calculate mean expression of selection B
        for(var i = 0; i < lengthB; i++){
          meanOfB += selBexpr[i];
        }

        meanOfA = meanOfA/lengthA;
        meanOfB = meanOfB/lengthB;

        var stdDevA = 0;
        var stdDevB = 0;

        //calculate standard deviation for expression of selection A
        for(var i = 0; i < lengthA; i++){
          stdDevA += Math.pow((selAexpr[i]-meanOfA),2);
        }
        //calculate standard deviation for expression of selection B
        for(var i = 0; i < lengthB; i++){
          stdDevB += Math.pow((selBexpr[i]-meanOfB),2);
        }
        stdDevA = Math.sqrt(stdDevA/(lengthA-1));
        stdDevB = Math.sqrt(stdDevB/(lengthB-1));
        var degreesFreedom = lengthA+lengthB - 2;

        //calculate associated t score for gene
        var t_score = Math.abs((meanOfA-meanOfB)/Math.sqrt( Math.pow((stdDevA/lengthA),2) + Math.pow((stdDevB/lengthB),2)))
        var zSign = (meanOfA > meanOfB ?1:-1);
        var fold = Math.min(meanOfA/meanOfB,1);
        var mean = meanOfA;

        //check to see if t_score passes lower threshold
        if(t_score >= 2.25){
          params.results.push({Z:(t_score*zSign), absZ:t_score, name: geneData.colnames[gene], fe: fold, M:mean, highest:(zSign >= 0)});
        }
      }
}*/

// event listener functions as channel for communication between worker and Master
self.addEventListener("message", function(e){
  var callParams = e.data;

  /**
  * Setup command
  *
  * Worker requests cell data from its master
  *
  * request type: Cell order
  */
  if(callParams.command.type === "setup"){
    var response = {
      request:{
        type: "cell order"
      },
      params: callParams.params
    }
    postMessage(response);
  }

  /**
   * Initiate command
   *
   * Recieves cell name data from the master thread and initializes the selection index arrays
   *
   * Requests a subset of the genes at a time
   *
   * params step set to number of genes requested per request made
   * params index set to 0, index will represent next gene to interpret
   * params numCells is the number of cells
   *
   * request expr vals
   * request data: contains the gene names that are being asked for
   */
  else if(callParams.command.type === "initiate"){
    callParams.params.step = Math.max(Math.floor(callParams.params.geneNames.length/200),10);
    callParams.params.index = 0;
    callParams.params.numCells = callParams.command.data.length;

    //if there is only one selection given make the second selection off of the indexes of the cellOrderData keys
    if(callParams.command.selections.length === 1){
      callParams.params.selAidx = [];
      callParams.params.selBidx = [...callParams.command.data.keys()];
      //creates array of cell indexes based on their corresponding index in cell order array
      for(var i = 0; i < callParams.command.selections[0].length; i++){
        var idx = callParams.command.data.indexOf(callParams.command.selections[0][i]);
        if(idx !== -1){
          callParams.params.selAidx.push(idx);
        }
      }

    }
    //makes selection index arrays for two selections
    else if(callParams.command.selections.length === 2){
      callParams.params.selAidx = [];
      callParams.params.selBidx = [];
      for(var i = 0; i < callParams.command.selections[0].length; i++){
        var idx = callParams.command.data.indexOf(callParams.command.selections[0][i]);
        if(idx !== -1){
          callParams.params.selAidx.push(idx);
        }
      }
      for(var i = 0; i < callParams.command.selections[1].length; i++){
        var idx = callParams.command.data.indexOf(callParams.command.selections[1][i]);
        if(idx !== -1){
          callParams.params.selBidx.push(idx);
        }
      }
    }
    postMessage({
      request:{
        type: "expr vals",
        data: callParams.params.geneNames.slice(callParams.params.index, Math.min(callParams.params.index + callParams.params.step,callParams.params.geneNames.length)),
      },
      params: callParams.params
    });
  }


  /**
   * Process Command
   *
   * Process a chunk of data based on the chosen method then requests more data in a similar way to other unless no more data remains, otherwise requests death
   *
   * request 1
   * request type: expr vals
   * request data: contains the gene names that are being asked for next
   *
   * request 2
   * request type: clean death
   */
  else if(callParams.command.type === "process"){
    if(callParams.params.method === "default" || callParams.params.method === "ksTest"){
      runKSonGroup(callParams.params, callParams.command.data);
    }
    else if(callParams.params.method === "wilcoxon"){
      runWilcoxonOnGroup(callParams.params, callParams.command.data);
    }
    else if(callParams.params.method === "tTest"){
      runTtestOnGroup(callParams.params, callParams.command.data);
    }
    callParams.params.index += callParams.params.step;//advance index to current spot

    //continue requesting data if data still needs to be read
    if(callParams.params.index < callParams.params.geneNames.length){
      postMessage({
        request:{
          type: "expr vals",
          data: callParams.params.geneNames.slice(callParams.params.index, Math.min(callParams.params.index + callParams.params.step, callParams.params.geneNames.length)),
        },
        params: callParams.params
      })
    }
    else{
      postMessage({
        request:{
          type: "clean death"
        },
        params: callParams.params
      })
    }
  }

  /**
   * User has issued a stop command
   * Halts progress of analysis and sends the main thread a message to kill this worker and not call the callback
   */
  else if(callParams.command.type === "stop"){
      postMessage({
        request:{
          type: "abrupt death"
        },
      })
  }
},false);






