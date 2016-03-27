Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};


Components.utils.import("resource://printPages2PdfMod/srcObject.jsm",printPages2Pdf); 
Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/prefsUtils.jsm",printPages2Pdf); 
Components.utils.import("resource://printPages2PdfMod/domLoader.jsm",printPages2Pdf); 
Components.utils.import("resource://printPages2PdfMod/archives.jsm",printPages2Pdf);



printPages2Pdf._processDisp = function(){
	this._busyDeck=document.getElementById("busyDeck");
	
	this._grid=document.getElementById("progressGrid");
	this._ndTemplateBox=document.getElementById("ProgrGridTemplateContainer");
	this._template=this._ndTemplateBox.getElementsByAttribute("role","rowTemplate")[0];
	this._texttemplate=this._ndTemplateBox.getElementsByAttribute("role","textTemplate")[0];
	this._rows=this._grid.getElementsByTagName("rows")[0];
	
	this._box_progressGrid=document.getElementById("box_progressGrid");	

}

printPages2Pdf._processDisp.prototype = {
	_box_progressGrid:null,
	_busyDeck:null,
	_texttemplate:null,
	_grid : null,
	_template : null,	
	_rows : null,
	_currentRow:null,
	_curLabel:null,
	_curMessage:null,
	_curProgress:0,
	_curImage:null,
	_curProgressDeck:null,
	_curTypeImageDeck:null,
	_curPhase:0,
	_maxMessage:25,
	_maxLabel:20,
	
	set undetermined(bUndetermined){
		if(! this._curProgressDeck) return;
		if(bUndetermined)
			this._curProgressDeck.selectedIndex=1;
		else
			this._curProgressDeck.selectedIndex=0;
	},
	
	get undetermined(){
		if(! this._curProgressDeck) return false;
		return (this._curProgressDeck.selectedIndex == 1);
	},
	
	fmtTime:function(dt){
		
		var hour=String(dt.getHours()).replace(/^([0-9])$/,"0$1") ;
		var minute=String(dt.getMinutes()).replace(/^([0-9])$/,"0$1") ;
		var second=String(dt.getSeconds()).replace(/^([0-9])$/,"0$1") ;
		
		return hour + ":" + minute + ":" + second  + "." + dt.getMilliseconds();  
	},

	set type(t){
		if(! this._curTypeImageDeck) return;
		
		switch(t){
			case "pageload":
				this._curTypeImageDeck = this._curTypeImageDeck.selectedIndex=0;
				break;
			case "download":
				this._curTypeImageDeck = this._curTypeImageDeck.selectedIndex=1;
				break;
			case "convert":
				this._curTypeImageDeck = this._curTypeImageDeck.selectedIndex=2;
				break;
			case "process":
				this._curTypeImageDeck = this._curTypeImageDeck.selectedIndex=3;
				break;
		}
	},
		
	set isBusy(stat){
		if(! this._busyDeck)return;
		switch(stat){
			case "running":
				this._busyDeck.setAttribute("collapsed",false);
				this._busyDeck.setAttribute("selectedIndex",0);				
				break;
			case "finish_success":
				this._busyDeck.setAttribute("collapsed",false);
				this._busyDeck.setAttribute("selectedIndex",1);				
				break;
			case "finish_error":
				this._busyDeck.setAttribute("collapsed",false);
				this._busyDeck.setAttribute("selectedIndex",2);				
				break;
			case "init":
				this._busyDeck.setAttribute("collapsed",true);
				break;
			
		}
	},
	set label(txt){
		if (this._curLabel) {
			this._curLabel.value = txt;
			this._curLabel.setAttribute("tooltiptext",txt);
		}
		
	},
	set message(txt){
		if (this._curMessage) {
			this._curMessage.value = txt;
			this._curMessage.setAttribute("tooltiptext",txt);
		}
	},
	get message(){
//		return this._curMessage.firstChild.data;
		if(this._curMessage) return this._curMessage.value;
	},
	set progress(iVal){
		if (this._curProgress) {
			var val=parseFloat(iVal);
			if(val > 100) val %= 100;
			if((this.status == "none" || this.status == "success") && 
				(!this.message || (this.message == (this._curProgress.value + "%") )))
				this.message=val + "%";
			
			this._curProgress.value =val;
		}
	},
	get progress(){
		if(!this._curProgress || this._curProgress.value) return 0;
		return parseFloat(this._curProgress.value);
	},
	
	get status() { return this._currentRow.getAttribute("status");},
	set status(strState){
		switch(strState){
			case "success":
				this._curProgress.setAttribute("class","meter");
				this._curImage.src = "chrome://printPages2Pdf/skin/success.png";
				this._currentRow.setAttribute("status",strState);
				break;
			case "error":
				this._curProgress.setAttribute("class","red meter");
				this._curImage.src = "chrome://printPages2Pdf/skin/Error.png";
				this._currentRow.setAttribute("status",strState);
				break;
			case "warning":
				this._curProgress.setAttribute("class","orange meter");
				this._curImage.src = "chrome://printPages2Pdf/skin/Warning.png";
				this._currentRow.setAttribute("status",strState);
				break;
			default:
				this._curImage.src = "";
				this._currentRow.setAttribute("status","none");
				break;
						
		}
	},
	

}


printPages2Pdf._processDisp.prototype.setCurrent = function(ndRow){
	this._currentRow=ndRow;
	this._curLabel=ndRow.getElementsByAttribute("role","label")[0];
	this._curMessage=ndRow.getElementsByAttribute("role","message")[0];
	this._curProgress=ndRow.getElementsByAttribute("role","progress")[0];
	this._curImage=ndRow.getElementsByAttribute("role","image")[0];
	this._curPhase=ndRow.getAttribute("phase");
	this._curProgressDeck = this._currentRow.getElementsByAttribute("role","progressdeck")[0];
	this._curTypeImageDeck = this._currentRow.getElementsByAttribute("role","typeimagedeck")[0];
	

	
	this._curProgress.value=0;
}

printPages2Pdf._processDisp.prototype.reset = function(){
	while(this._rows.lastChild)
		this._rows.removeChild(this._rows.lastChild);
}


printPages2Pdf._processDisp.prototype.startup = function(){
	this.timeStart=new Date();
	
	this.addTextRow(RRprintPages2Pdf.strb.GetStringFromName("processLog.started") + " " + this.fmtTime(this.timeStart));
	this.isBusy="running";
}

printPages2Pdf._processDisp.prototype.finish = function(result){

	if(this.undetermined)
		this.undetermined = false;
	
	
	this.timeFinish=new Date();
	var diff=(this.timeFinish.getTime() - this.timeStart.getTime())/1000;
	
	this.addTextRow(RRprintPages2Pdf.strb.GetStringFromName("processLog.finished") + " "  + this.fmtTime(this.timeFinish) + "  => " + diff + " s");
		
	this.isBusy=result;
	
	switch(result){
		case "finish_success":		
			if (this.progress == 0) 
				this.progress = 100; //if no progress_changed		
			if (this.status == "none") 
				this.status = "success";
			break;
		case "finish_error":
			if (this.progress == 0) 
				this.progress = 60; //if no progress_changed		
			if (this.status == "none") 
				this.status = "error";
			break;
	}
	
}

printPages2Pdf._processDisp.prototype.addTextRow = function(txt){
	if(! this._texttemplate) return;
	
	var newText=this._texttemplate.cloneNode(true);
	newText.setAttribute("hidden","false");
	var lbl=newText.getElementsByTagName("label")[0];
	lbl.setAttribute("value",txt);
	
	this._rows.appendChild(newText);
	
  try {
  	var xpcomInterface = this._box_progressGrid.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
  	xpcomInterface.ensureElementIsVisible(newText);
  }
  catch(e)
  {  }		
	
}


printPages2Pdf._processDisp.prototype.addRow = function(nrPhase,txtLabel,progressVal,imageUrl,txtMessage) {
	var newRow=this._template.cloneNode(true);
	
	newRow.setAttribute("hidden","false");
//	newRow.setAttribute("phase",nrPhase);
	newRow.setAttribute("phase",++this._curPhase);
	this._rows.appendChild(newRow);
	
	if (this._currentRow) {
		if (this.progress == 0) 
			this.progress = 100; //if no progress_changed		
		if (this.status == "none") 
			this.status = "success";
	}
	
	
	this.setCurrent(newRow);
	
	if(txtLabel) this.label=txtLabel;
	else
		this.label="";
		
	if(progressVal) this.progress=progressVal;
	if(imageUrl) this.image=imageUrl;
	
	if(txtMessage) this.message=txtMessage;
	else
		this.message="";

  try {
  	var xpcomInterface = this._box_progressGrid.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
  	xpcomInterface.ensureElementIsVisible(newRow);
  }
  catch(e)
  {  }		
}

printPages2Pdf._downloadCallback = function(parent){
	this._parent=parent;
}
printPages2Pdf._downloadCallback.prototype = {
	_parent:null,
	
	onDownloadComplete: function(aItem, saver, a, b){
		var percDone = Math.round(((saver.numHttpTasks[aItem.id] - saver.httpTask[aItem.id]) * 100) / saver.numHttpTasks[aItem.id]);
		this._parent.processDisp.progress = percDone;
		if (this._parent.processDisp.status == "none") 
			this._parent.processDisp.message = percDone + "%";
		this._parent.updateWindow();
		
		
		
	},
	
	onAllDownloadsComplete: function(aItem, saver){
		this.onCaptureComplete(aItem, saver);
	},
	
	onDownloadProgress: function(aItem, aFileName, aProgress, saver){
	},
	
	onCaptureComplete: function(aItem, saver){
		if (aItem && saver && ("id" in aItem) && ("httpTask" in saver) && (aItem.id in saver.httpTask)) 
			delete saver.httpTask[aItem.id];
		
		this._parent.processDisp.progress = 100;
		if (this._parent.processDisp.status == "none") 
			this._parent.processDisp.message = "100%";
		this._parent.processDisp.status="success";
		this._parent.updateWindow();
		
	},
	
	onPageDownloadStart: function(aItem, saver){
		//saver.status=RRprintPages2Pdf.RUNNING; 
		this._parent.processDisp.addRow(0, aItem.title, 0, null, null);
		this._parent.processDisp.type = "download";
		//window.sizeToContent();
		this._parent.updateWindow();
		
	}
}





printPages2Pdf._processHandler = function() {
}

printPages2Pdf._processHandler.prototype = {
	_lastPrefPopupTarget:null,
	_ndbrDocavailable:null,
	_ndMainTabBox:null,
	_ndMenDocTitle:null,
	_ndPdfFileLabel:null,
	_ndPdfSaveButton:null,
	_ndBrEditWin : null,				
	_nsPdfResultFile : null,
	_nsPdfResultFiles : null,
	_prefOverrides:null,
	_ndPopmenSave:null,
	processDisp: null,
	domWindowUtils : null,
	__workDir:null,
	_isInit:false,
	_ndPageList:null,
	_nBrItemListSelection:null,
	_nbrPreview : null,
	_ndPageListItemTemplate:null,
	_ndListTitel:null,
	_ndListcbImage:null,
	_ndListcbTextOnly:null,
	_ndListImgSource:null,
	_ndListImgItem:null,

	__ioService:null,
	get ioService(){
		if(!printPages2Pdf._processHandler.prototype.__ioService)
			printPages2Pdf._processHandler.prototype.__ioService= Components.classes["@mozilla.org/network/io-service;1"]  
                  													.getService(Components.interfaces.nsIIOService); 
		return  printPages2Pdf._processHandler.prototype.__ioService;
	},
	
	
	
	onPdfDragStart: function(evt){

	    var dt = evt.dataTransfer;

		var nsTransferFile=this._nsPdfResultFiles[0];
		
		if(this._nsPdfResultFiles.length > 1){ //create a zip for the files
		    const PR_RDWR        = 0x04;  
		    const PR_CREATE_FILE = 0x08;  
		    const PR_TRUNCATE    = 0x20;  
		    var zipWriter = Components.Constructor("@mozilla.org/zipwriter;1", "nsIZipWriter");  
    		var zipW = new zipWriter();  
			
			nsTransferFile=this.createUserTempDir();
			nsTransferFile.append("WebPages.zip");

      
    		zipW.open(nsTransferFile, PR_RDWR | PR_CREATE_FILE | PR_TRUNCATE);  
			for (var i = 0; i < this._nsPdfResultFiles.length; i++) {
				try {
					zipW.addEntryFile(this._nsPdfResultFiles[i].leafName, Components.interfaces.nsIZipWriter.COMPRESSION_FASTEST, this._nsPdfResultFiles[i], false);				
				
				} catch (e ) {  
					if (e.name == "NS_ERROR_FILE_ALREADY_EXISTS") {
						var fName=this._nsPdfResultFiles[i].leafName.replace(/\.pdf$/,"");
						fName += "-" + Math.floor(Math.random() * (10000)) + ".pdf";
						zipW.addEntryFile(fName, Components.interfaces.nsIZipWriter.COMPRESSION_FASTEST, this._nsPdfResultFiles[i], false);				
						
					}
				}
			}  
    		zipW.close();  				
		}	

	    dt.mozSetDataAt("application/x-moz-file", nsTransferFile, 0);

		var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		var fileUrl=IO.newFileURI(nsTransferFile).spec;
		
		dt.setData("text/uri-list", fileUrl);
		dt.setData("text/plain", fileUrl);
		
		
	    dt.effectAllowed = "copy";
	},
	
	init : function(){
		if(this._isInit == true) return;
		this._isInit = true;
		
		this.UISetInitWindowSize(280,340);
		var me=this;
		
		this._ndPdfFileLabel=document.getElementById("PdfFileLabel");
		this._ndPdfFileLabel.addEventListener("click",function(evt){me.onPdfFileLabel(evt);},false);
		this._ndPdfFileLabel.addEventListener("dragstart",function(evt){me.onPdfDragStart(evt);},false);		
				
		this._ndMainTabBox=document.getElementById("mainTabBox");

		this._ndMainTabs=document.getElementById("mainTabs");
		this._ndMainTabs.addEventListener("select",function(evt){me.onTabChanged(evt);},false);	

		this._ndClearProgressButton=document.getElementById("ClearProgressButton");
		this._ndClearProgressButton.addEventListener("command",function(evt){me.onClearProgress(evt);},false);	


		this._ndMenDocTitle=document.getElementById("menDocTitle");
		
		this._nBrItemListSelection = document.getElementById("brItemListSelection");

		this._nbrPreview = document.getElementById("brPreview");
		if(!RRprintPages2Pdf.pdfJsEnabled)
			this._nbrPreview.setAttribute("hidden","true");
		
		
		this._ndBrEditWin=document.getElementById("brEditWin");
		
		this._ndbrDocavailable=document.getElementById("brDocavailable");
		
		this._ndMainToolbox=document.getElementById("mainToolbox");
		this._ndMainToolbox.addEventListener("command",function(evt){me.onMainToolboxCommand(evt);},false);
		
		document.getElementById("ctxMenItemList").addEventListener("command",function(evt){me.onMainToolboxCommand(evt);},false);

		this._ndTbBoxProgress=document.getElementById("tbBoxProgress");
		this._ndTbBoxItems=document.getElementById("tbBoxItems");
		this._ndPdfProcessButton=document.getElementById("PdfProcessButton");
		this._ndPdfStopProcessButton=document.getElementById("PdfStopProcessButton");
		this._ndStartStopDeck=document.getElementById("StartStopDeck");
		


		this._ndPageList=document.getElementById("rlb_pagelist");
		this._ndPageList.addEventListener("select",function(evt){me.onPageListSelect(evt);},false);
		this._ndPageList.addEventListener("dragstart",function(evt){me.onDragStartListItem(evt);},false);
		this._ndPageList.addEventListener("dragover",function(evt){me.onDragOverListItem(evt);},false);
		this._ndPageList.addEventListener("drop",function(evt){me.onDropListItem(evt);},false);
		
		this._ndPageListItemTemplate=document.getElementsByAttribute("role","rli_template")[0];
		this._ndPageListTocTemplate=document.getElementsByAttribute("role","rli_toctemplate")[0];
		this._ndListTitel=this._ndPageListItemTemplate.getElementsByAttribute("role","lbl_title")[0];
		this._ndListcbImage=this._ndPageListItemTemplate.getElementsByAttribute("role","cb_isImage")[0];
		this._ndListcbTextOnly=this._ndPageListItemTemplate.getElementsByAttribute("role","cb_isText")[0];
		this._ndListImgSource=this._ndPageListItemTemplate.getElementsByAttribute("role","img_src")[0];
		this._ndListImgItem=this._ndPageListItemTemplate.getElementsByAttribute("role","img_item")[0];
		
		document.getElementById("pref_btOk").addEventListener("command",function(evt){me.onBtPrefOk(evt);},false);
		document.getElementById("pref_btCancel").addEventListener("command",function(evt){me.onBtPrefCancel(evt);},false);
		document.getElementById("objectPrefPopup").addEventListener("popupshowing",function(evt){me.onPrefPopupShowing(evt);},false);

		//Init the processing moules		
		printPages2Pdf._srcObject.prototype.canvas=document.getElementById('printPages2Pdf_buffer_canvas');
		printPages2Pdf._srcObject.prototype.persistCallback=new printPages2Pdf._downloadCallback(this);
		printPages2Pdf._srcObject.prototype.parentWindow=window;
		printPages2Pdf._srcObject.prototype.domLoadCallback = function(step, args){	me.webPageLoaded(step, args);};
		printPages2Pdf._srcObject.prototype.workDir=this._workDir;
		
		//Use this if in the future TOC will be supported
		RRprintPages2Pdf.gPrefObserver.tocCallback = function(evt){me.onCreateTocChanged(evt);};
		
		RRprintPages2Pdf.gPrefObserver.coverCallback = function(evt){me.onCreateCoverChanged(evt);};
		
		document.getElementById("mainToolbar").setAttribute("mode",RRprintPages2Pdf.prefs.getCharPref("ui.toolbarbuttons"));

		this._ndPopmenSave=document.getElementById("popmen_save");

	},
	
	listFavorites:function(event){
		if(this._ndPopmenSave.hasChildNodes()) return;
		var favs=printPages2Pdf.arcFavorites.favorites;
		if(Object.keys(favs).length == 0 ) return;
		
		var file = Components.classes["@mozilla.org/file/local;1"]
                       .createInstance(Components.interfaces.nsILocalFile);
		
		for(var i in favs){
			file.initWithPath(i);
			var item=document.createElement("menuitem");
			item.setAttribute("label",file.leafName);
			item.setAttribute("value",file.path);
			item.setAttribute("name","favitem");
			item.setAttribute("tooltiptext",file.path);
			item.setAttribute("class","menuitem-iconic men_favfolder");
			this._ndPopmenSave.appendChild(item);
		}
		
	},
	
	onClearProgress:function(event){
		this.processDisp.reset();
	},
	
	onTabChanged:function(event){
		//alert(event.currentTarget.nodeName);
		if(event.currentTarget.nodeName != "tabs") return;
		
		switch(event.currentTarget.selectedIndex){
			case 0:
				this._ndTbBoxProgress.setAttribute("collapsed",false);
				this._ndTbBoxItems.setAttribute("collapsed",true);
				break;
			case 1:
				this._ndTbBoxProgress.setAttribute("collapsed",true);
				this._ndTbBoxItems.setAttribute("collapsed",false);
				break;
				
			default:
				this._ndTbBoxProgress.setAttribute("collapsed",true);
				this._ndTbBoxItems.setAttribute("collapsed",true);
				break;
		}	 	
	},
	
	bookmarksRecursive:function(placeInfo,retAr,bDeep){
		
		if(placeInfo.type == "text/x-moz-place"){
			var srcObject=new printPages2Pdf._srcObject(placeInfo.uri);
			srcObject.Title=placeInfo.title;
			if((placeInfo.annos instanceof Array) && placeInfo.annos.length > 0){
				srcObject.Description=placeInfo.annos[0].value;
			}
			srcObject.sourceType="bookmark";
			retAr.push(this.newWebpageItem(srcObject));
			
		}
		
		if(("children" in placeInfo) && bDeep){
			for(var i=0;i < placeInfo.children.length;i++){
				this.bookmarksRecursive(placeInfo.children[i],retAr,bDeep);
			}
		}
	},
	
	onDropListItem:function(event){
		
		var srcItems=[];
		var targetItem=event.target;
		if(targetItem.nodeName == "richlistbox")
			targetItem=null;
		else
			while( targetItem && targetItem.nodeName != "richlistitem" ) targetItem=targetItem.parentNode;

		for (var dropCnt = 0; dropCnt < event.dataTransfer.mozItemCount; dropCnt++) {
			if (event.dataTransfer.types.contains("application/x-pagelistitem")) {//internal ListView item
				var index = event.dataTransfer.mozGetDataAt("application/x-pagelistitem",dropCnt);
				srcItems.push(this._ndPageList.childNodes[index]);
			}
			else 
				if (event.dataTransfer.types.contains("text/x-moz-place")) {//bookmark
					var strObj = event.dataTransfer.mozGetDataAt("text/x-moz-place",dropCnt);
					var placeInfo = JSON.parse(strObj);
					this.bookmarksRecursive(placeInfo, srcItems, true);
				}
				else if (event.dataTransfer.types.contains("application/x-moz-tabbrowser-tab")) {//browsertab
					var tab = event.dataTransfer.mozGetDataAt("application/x-moz-tabbrowser-tab",dropCnt);
					var srcObject=new printPages2Pdf._srcObject(tab.linkedBrowser.contentWindow);
					if(tab.linkedBrowser.contentTitle)
						srcObject.Title=tab.linkedBrowser.contentTitle;
					srcObject.sourceType="browsertab";

					srcItems.push(this.newWebpageItem(srcObject));
				}
				else 
					if (event.dataTransfer.types.contains("moz/rdfitem")) {//scrapbook item
						var strId = event.dataTransfer.mozGetDataAt("moz/rdfitem",dropCnt);
						var propsAr = RRprintPages2Pdf.getSbRdfObject(strId, true);
						if (propsAr) {
							for (var i = 0; i < propsAr.length; i++) {
								var srcObject = new printPages2Pdf._srcObject(propsAr[i].location);
								srcObject.Title = propsAr[i].title;
								if (propsAr[i].comment) {
									srcObject.Description = propsAr[i].comment;
								}
								if (propsAr[i].source) 
									srcObject.setOriginUrl(propsAr[i].source);
								
								srcObject.sourceType="scrapbook";
								if(propsAr[i].favIconUrl) srcObject.favIconUrl=propsAr[i].favIconUrl;
								
								srcItems.push(this.newWebpageItem(srcObject));
							}
						}
					}
					else 
						if (event.dataTransfer.types.contains("text/uri-list")) {
							var url = event.dataTransfer.mozGetDataAt("text/uri-list",dropCnt);
							srcItems.push(this.newWebpageItem(new printPages2Pdf._srcObject(url)));
						}
						else 
							if (event.dataTransfer.types.contains("text/x-moz-url")) {
								var url = event.dataTransfer.mozGetDataAt("text/x-moz-url",dropCnt);
								srcItems.push(this.newWebpageItem(new printPages2Pdf._srcObject(url)));
							}			
							else 
								if (event.dataTransfer.types.contains("text/plain")) {
									var url = event.dataTransfer.mozGetDataAt("text/plain",dropCnt);
									try {
										var uri=this.ioService.newURI(url, null, null);  //test if text is url
										srcItems.push(this.newWebpageItem(new printPages2Pdf._srcObject(url)));
									} 
									catch(ex){}
									
								}			
		}
		
		for(var i=0; i < srcItems.length; i++)
			this._ndPageList.insertBefore(srcItems[i], targetItem);


	},
	
	onDragOverListItem:function(event){
	  if (event.dataTransfer.types.contains("application/x-pagelistitem") ||
	  		event.dataTransfer.types.contains("text/x-moz-place")||
	  		event.dataTransfer.types.contains("application/x-moz-tabbrowser-tab")||
	  		event.dataTransfer.types.contains("moz/rdfitem")||
	  		event.dataTransfer.types.contains("text/x-moz-url")||
	  		event.dataTransfer.types.contains("text/uri-list")
	  )
	    event.preventDefault();		

	  else if (event.dataTransfer.types.contains("text/plain")){
	  	
			try {
				var url = event.dataTransfer.getData("text/plain");
				var uri=this.ioService.newURI(url, null, null);  //test if text is url
			    event.preventDefault();		
			} 
			catch(ex){}
	  }

		
	},
	
	onDragStartListItem:function(event){
		var parentItem=event.target;
		while( parentItem && parentItem.nodeName != "richlistitem" ) parentItem=parentItem.parentNode;
		
		if(parentItem){
			event.dataTransfer.setData("application/x-pagelistitem", this._ndPageList.getIndexOfItem(parentItem));
			event.dataTransfer.effectAllowed = "move";
		}
		
	},
	
	stopProcessing:function(){
		RRprintPages2Pdf.stopProcessing=true;

		this._ndPdfStopProcessButton.disabled=true;
		this._ndPdfProcessButton.disabled=true;
				

		if ((RRprintPages2Pdf.persistLoops + RRprintPages2Pdf.domloaderLoops) > 0) {
			RRprintPages2Pdf.stopPersist = RRprintPages2Pdf.stopDomloader = true;
			var me=this;
			window.setTimeout(function(){me.stopProcessing();},100);
			return;		
		}

		if (this.pdfWorker) {
			this.pdfWorker.postMessage({
				cmd: "close",
			});
			this.pdfWorker = null;
		}
		

	},

	saveLastPdfFileTo:function(){
		var strTargetPath=null;
		var filePicker = Components.classes["@mozilla.org/filepicker;1"]
	                 .createInstance(Components.interfaces.nsIFilePicker);
						 
		filePicker.init(window, RRprintPages2Pdf.strb.GetStringFromName("filepicker.savepdf.title"), filePicker.modeSave);
		filePicker.defaultExtension = "pdf";
		filePicker.appendFilter(RRprintPages2Pdf.strb.GetStringFromName("filepicker.savepdf.typedesc.pdf"), "*.pdf");
		filePicker.appendFilters(filePicker.filterAll);
		filePicker.filterIndex = 0;
		filePicker.defaultString = this._nsPdfResultFile.leafName;
		
		if (filePicker.show() != filePicker.returnOK || filePicker.file == null) 
			return;
		
		this._nsPdfResultFile.copyTo(filePicker.file.parent, filePicker.file.leafName);
		RRprintPages2Pdf.observerService.notifyObservers(filePicker.file.clone(), "pp2pdf-newlibraryfile", filePicker.file.path);
								
	},
	


	savePdfFileTo:function(targetDir){
		var strTargetPath=null;
		if(!targetDir ){
			var filePicker = Components.classes["@mozilla.org/filepicker;1"]
		                 .createInstance(Components.interfaces.nsIFilePicker);
						 
			if (this._nsPdfResultFiles.length == 1 ||
					(RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate") &&
						RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate.ask"))			
			) 
			{
				filePicker.init(window, RRprintPages2Pdf.strb.GetStringFromName("filepicker.savepdf.title"), filePicker.modeSave);
				filePicker.defaultExtension = "pdf";
				filePicker.appendFilter(RRprintPages2Pdf.strb.GetStringFromName("filepicker.savepdf.typedesc.pdf"), "*.pdf");
				filePicker.appendFilters(filePicker.filterAll);
				filePicker.filterIndex = 0;
				
				for(var i=0; i < this._nsPdfResultFiles.length;i++)
				{
					var nsSrcFile=this._nsPdfResultFiles[i];
					if (this._nsPdfResultFiles.length == 1)
						filePicker.defaultString = this._nsPdfResultFile.leafName;
					else
						filePicker.defaultString = nsSrcFile.leafName;					
					
					if (filePicker.show() == filePicker.returnCancel || filePicker.file == null) {
						continue;
					}
					
					nsSrcFile.copyTo(filePicker.file.parent, filePicker.file.leafName);
					RRprintPages2Pdf.observerService.notifyObservers(filePicker.file.clone(), "pp2pdf-newlibraryfile", filePicker.file.path);
				}
				return;
				
			}
			else {
				filePicker.init(window, RRprintPages2Pdf.strb.GetStringFromName("filepicker.savepdfs.title"), filePicker.modeGetFolder);
				
				var retVal = filePicker.show();
				
				if (retVal == filePicker.returnCancel || filePicker.file == null) 
					return null;
				
				strTargetPath = filePicker.file.path;
			}
		}
		else
			strTargetPath=targetDir;
			
		var trgPath = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

		for (var i = 0; i < this._nsPdfResultFiles.length; i++) {
			try {
				trgPath.initWithPath(strTargetPath);					
				trgPath.append(this._nsPdfResultFiles[i].leafName);
				trgPath.createUnique(trgPath.NORMAL_FILE_TYPE, 0666);
				this._nsPdfResultFiles[i].copyTo(trgPath.parent, trgPath.leafName);
				RRprintPages2Pdf.observerService.notifyObservers(trgPath.clone(), "pp2pdf-newlibraryfile", trgPath.path);
				
			} catch(e){}
		}
					
	},
	
	
	onMainToolboxCommand:function(event){
		var trgNode=event.originalTarget;
		var trgName=trgNode.getAttribute("name");
		if (!trgName) {
			trgName = event.explicitOriginalTarget.getAttribute("name");
			trgNode=event.explicitOriginalTarget;
		}
		
		switch(trgName){
			case "PdfProcessButton":
				printPages2Pdf.pageEdit.askForSaving();
				this.start();
				break;

			case "PdfStopProcessButton":
				this.stopProcessing();
				break;
				
			case "favitem":
				this.savePdfFileTo(trgNode.getAttribute("value"));
				break;
				
			case "PdfSaveButton":				
				this.savePdfFileTo();
				break;	
				
			case "GlobalPropsButton":
				var features = "chrome,titlebar,toolbar,centerscreen,modal";
				window.openDialog("chrome://printPages2Pdf/content/prefs.xul", "Preferences", features);
				break;
					
			case "ItemsUpButton":
				var i=0;
				for (i = 0; i < this._ndPageList.childNodes.length; i++) { //look for the first unselected
					if (!this._ndPageList.childNodes[i].selected) 
						break;
				}
				for (; i < this._ndPageList.childNodes.length; i++) {
					if (this._ndPageList.childNodes[i].selected) {
						this._ndPageList.insertBefore(this._ndPageList.childNodes[i], this._ndPageList.childNodes[i - 1]);
					}
				}
				break;
				
			case "ItemsDownButton":
				var i=0;
				for (i = this._ndPageList.childNodes.length - 1; i >= 0; i--) { //look for the last unselected
					if (!this._ndPageList.childNodes[i].selected) 
						break;
				}
				for (;  i >= 0; i--) {
					if (this._ndPageList.childNodes[i].selected) {
						var before=(i == this._ndPageList.childNodes.length - 2)?null:this._ndPageList.childNodes[i + 2];
						this._ndPageList.insertBefore(this._ndPageList.childNodes[i], before);
					}
				}
				break;
				
			case "ItemsRemoveButton":
				var lastDel=0;
				for (var i = this._ndPageList.childNodes.length - 1; i >= 0; i--) { 
					if (this._ndPageList.childNodes[i].selected) {
						this._ndPageList.childNodes[i].setUserData("srcObject",null,null);
						this._ndPageList.removeChild(this._ndPageList.childNodes[i]);
						lastDel=i;
					}
				}
				
				if( lastDel < this._ndPageList.childNodes.length ) 
					this._ndPageList.selectedIndex=lastDel;
				else
					this._ndPageList.selectedIndex=this._ndPageList.childNodes.length - 1;
				break;
		}

	},
	
	onPageListSelect:function(event){
		this._nBrItemListSelection.setAttribute("disabled",event.currentTarget.selectedCount <= 0);
				
	},
	
	get _workDir()  {
		if (this.__workDir == null) {
			this.__workDir = RRprintPages2Pdf.UserAppTempDir.clone();
			this.__workDir.append("wd");
			this.__workDir.createUnique(this.__workDir.DIRECTORY_TYPE, 0777);
		}


		if(!this.__workDir.exists())
			this.__workDir.createUnique(this.__workDir.DIRECTORY_TYPE, 0777);
		
		
		return this.__workDir;
		
	},

	createUserTempDir : function(suggestedName){
		if(! suggestedName) suggestedName="tmpdir";
		
		var retVal=this._workDir.clone();
		try {
			retVal.append("tmpfile");
			retVal.createUnique(retVal.DIRECTORY_TYPE, 0777);
			
		} catch(e) {return null;}
		
		return retVal;		
		
	},

	
	createUserTempFile : function(suggestedName){
		if(! suggestedName) suggestedName="dummy";
		
		var retVal=this._workDir.clone();
		try {
			retVal.append("tmpfile");
			retVal.createUnique(retVal.DIRECTORY_TYPE, 0755);
			retVal.append(suggestedName);
			retVal.createUnique(retVal.NORMAL_FILE_TYPE,0666);
			
		} catch(e) {return null;}
		
		return retVal;		
		
	},
	
	onPageListItem: function(event){
		//alert(event.originalTarget.nodeName + " : " + event.currentTarget.nodeName);
		var role=event.originalTarget.getAttribute("role");
		var srcObject=event.currentTarget.getUserData("srcObject");
		switch(role){
			case "lbl_title":
				break;
			case "cb_isImage":
				srcObject.isImage=event.originalTarget.checked;
				break;
			case "cb_isText":
				srcObject.isTextOnly=event.originalTarget.checked;
				break;
			case "bt_props":
				break;
			case "bt_edit":
				var leftVbox=document.getElementById("leftVbox");
				var maxwidth=leftVbox.scrollWidth;
				leftVbox.setAttribute("maxwidth",maxwidth );
				
				printPages2Pdf.pageEdit.init(printPages2Pdf.oTree);

				leftVbox.removeAttribute("flex");

				var brEditWin=document.getElementById("brEditWin");				
				brEditWin.setAttribute("hidden","false");
				this.UISetInitWindowSize(80,80,true,true);
				leftVbox.setAttribute("width",maxwidth);
				leftVbox.removeAttribute("maxwidth");


				printPages2Pdf.pageEdit.loadObject(srcObject);
				
				break;
				
		}
		
		event.stopPropagation();
	},
		
	
	onPdfFileLabel : function(event){
		this.openPdfResult(this._nsPdfResultFile,true);
	},
	
	onCreateTocChanged:function(){
		var useToc=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.isTableOfContent");
		var tocs=this._ndPageList.getElementsByAttribute("isToc","true");
		if (useToc && useToc === "true") {
			if(tocs.length > 0) return;
			var tocObject = new printPages2Pdf._tocObject("toc", false);
			var covers=this._ndPageList.getElementsByAttribute("isCover","true");

			if(covers.length > 0)
				this._ndPageList.insertBefore(this.newWebpageItem(tocObject),covers[0].nextSibling);
			else
				this._ndPageList.insertBefore(this.newWebpageItem(tocObject),this._ndPageList.firstChild);				
		}
		else{
			
			for(var i=0;i < tocs.length;i++){
				this._ndPageList.removeChild(tocs[i]);
			}			

		}
		
	},
	
	onCreateCoverChanged:function(){
		var useCover=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.useCover");
		var covers=this._ndPageList.getElementsByAttribute("isCover","true");
		if (useCover && useCover === "true") {
			if(covers.length > 0) return;
			var coverObject = new printPages2Pdf._coverObject(RRprintPages2Pdf.strb.GetStringFromName("coverpage.default.captionText"), false);
			coverObject.pageList=this._ndPageList;
			coverObject.mainTitle=this._ndMenDocTitle;
			this._ndPageList.insertBefore(this.newWebpageItem(coverObject),this._ndPageList.firstChild);				
		}
		else{
			
			for(var i=0;i < covers.length;i++){
				this._ndPageList.removeChild(covers[i]);
			}			

		}
		
	},
	
	webPageLoaded:function(step,args){
		switch(step){
			case "start":
				this.processDisp.addRow(0, args.url, 0, null, null);
				this.processDisp.undetermined = true;
				this.processDisp.type = "pageload";
				//window.sizeToContent();
				this.updateWindow();

			
				break;
			case "finished":			
				//this._downloadWins.push(args.win);
				
				this.processDisp.undetermined=false;
				this.processDisp.progress=100;
				if(this.processDisp.status == "none")
					this.processDisp.message= "100%";
				this.updateWindow();
								
//				this.savePageLocal(args.win);
				break;

			case "timeout":			
				//this._downloadWins.push(args.win);
				
				this.processDisp.undetermined=false;
				this.processDisp.status = "warning"
				this.processDisp.message= RRprintPages2Pdf.strb.GetStringFromName("progress.message.loadtimeout");
				this.processDisp.progress=100;
				this.updateWindow();
								
//				this.savePageLocal(args.win);
				break;

			case "loaderror":			
				//this._downloadWins.push(args.win);
				
				this.processDisp.undetermined=false;
				this.processDisp.status = "error"
				this.processDisp.message= RRprintPages2Pdf.strb.GetStringFromName("progress.message.loaderror");
				this.processDisp.progress=100;
				this.updateWindow();
				this.controller();
				break;

				
			case "progress":
				var percDone=(( args.curTot * 100 ) / args.maxTot );
				break;
				
			case "status":
				if (this.processDisp.status == "none") {
					this.processDisp.message = args.aMessage;
					this.updateWindow();
					//window.sizeToContent();

				}
				break;
			
		}	
		
	},
	
	UISetInitWindowSize: function(relWidth,relHeight,perc,center)
	{	
		var width=relWidth;
		var height=relHeight;
		
		
		var screenMan = Components.classes["@mozilla.org/gfx/screenmanager;1"]
		                .getService(Components.interfaces.nsIScreenManager);
		var scrleft = {}, scrtop = {}, scrwidth = {}, scrheight = {};
		screenMan.primaryScreen.GetRect(scrleft, scrtop, scrwidth, scrheight);
		
		if(perc){
		    width=(width * scrwidth.value) / 100;
		    height=(height * scrheight.value) / 100;	
		}
		else {
		    width=width * (scrwidth.value / 1000);
		    height=height * (scrheight.value / 1000);	
		}
	
/*
		var dlg=document.getElementById("id_dlg");
		dlg.setAttribute("title",window.arguments[0].inn.title);

*/
		if(center){
			window.moveTo((scrwidth.value - width)/2,(scrheight.value - height)/2);
		}
		window.resizeTo(width,height);
	},
	
	newWebpageItem:function(pageObject){
		//var newItem=this._ndPageList.appendItem(null);
		
		
//		this._ndListTitel.setAttribute("value",pageObject.Title);
		this._ndListTitel.value=pageObject.Title;
		if(pageObject.Description)
			this._ndListTitel.setAttribute("tooltiptext",pageObject.Description);
		else
			this._ndListTitel.removeAttribute("tooltiptext");
			
		
		if(pageObject.isImage == true)
			this._ndListcbImage.setAttribute("checked","true");
		else
			this._ndListcbImage.setAttribute("checked","false");
			
		if(pageObject.isTextOnly == true)
			this._ndListcbTextOnly.setAttribute("checked","true");
		else
			this._ndListcbTextOnly.setAttribute("checked","false");

//		newItem.appendChild(this._ndPageListItemTemplate.firstChild.cloneNode(true));

		this._ndListImgSource.setAttribute("type",pageObject.sourceType);
		
		//replaced by async function call
		//this._ndListImgItem.setAttribute("src",pageObject.favIconUrl);
		
		this._ndPageList.selectedItem=-1; //from some reasons clone otherwise fails

		var newItem=this._ndPageListItemTemplate.cloneNode(true);
		newItem.setUserData("srcObject",pageObject,null);
		var me=this;
		newItem.addEventListener("command",function(evt){me.onPageListItem(evt);},false);
		newItem.setAttribute("hidden","false");
		this._ndMenDocTitle.appendItem(pageObject.Title,pageObject.Title);
		
		if (pageObject.sourceType == "toc") {
			newItem.getElementsByAttribute("role", "cb_isImage")[0].setAttribute("style", "visibility:hidden;");
			newItem.getElementsByAttribute("role", "cb_isText")[0].setAttribute("style", "visibility:hidden;");
			newItem.getElementsByAttribute("role", "bt_edit")[0].setAttribute("style", "visibility:hidden;");
			newItem.setAttribute("isToc", "true");
		}

		if (pageObject.sourceType == "cover") {
			newItem.getElementsByAttribute("role", "cb_isImage")[0].setAttribute("style", "visibility:hidden;");
			newItem.getElementsByAttribute("role", "cb_isText")[0].setAttribute("style", "visibility:hidden;");
			newItem.getElementsByAttribute("role", "bt_edit")[0].setAttribute("style", "visibility:hidden;");
			newItem.setAttribute("isCover", "true");
		}
		
		newItem.onSetFavIcon=function(aURI, DataLen, aData, aMimeType){
			if(!aURI || !aURI.spec) return;
			var img=newItem.getElementsByAttribute("role","img_item" )[0];
			img.setAttribute("src",aURI.spec);
		}	
		
		//call async facicon update
		pageObject.updateFavIcon(newItem.onSetFavIcon);
		
		return newItem;		
	},
	
	UIaddPageItem: function(pageObject){
		
		this._ndPageList.appendChild(this.newWebpageItem(pageObject));	
		
		
	},

	getWebPageOptPrefs:function(gPrefOptions){
		var prefNames=["header.left","header.center","header.right","footer.left","footer.center","footer.right",];
		var progrStep=(90 - this.processDisp.progress) / (prefNames.length + 2)
		var webPageOptPrefs={};
		for(var i=0; i < prefNames.length;i++){
			this.processDisp.progress += progrStep;
			if(prefNames[i] in gPrefOptions){
				if (RegExp(/\[webpage\]/).test(gPrefOptions[prefNames[i]])) {
					webPageOptPrefs[prefNames[i]] = gPrefOptions[prefNames[i]];
				}
			}
		}

		prefNames=["header.htmlUrl","footer.htmlUrl"];
		for(var i=0; i < prefNames.length;i++){
			this.processDisp.progress += progrStep;
			if(prefNames[i] in gPrefOptions){
				var localFile = Components.classes["@mozilla.org/file/local;1"]
				                .createInstance(Components.interfaces.nsILocalFile);
				localFile.initWithPath(gPrefOptions[prefNames[i]]);				
				var content=RRprintPages2Pdf.ReadTextFile(localFile);
				if (RegExp(/\[webpage\]/).test(content)) {
					webPageOptPrefs[prefNames[i]] = gPrefOptions[prefNames[i]];
					webPageOptPrefs["__data." + prefNames[i]] = content;
				}
			}
		}
		
		return ((Object.keys(webPageOptPrefs).length == 0)?null:webPageOptPrefs);
	},
	
	setOptionsFromFile:function(section){
	    // create an nsILocalFile  
	    var cl = "@mozilla.org/file/local;1";  
	    var interf = Components.interfaces.nsILocalFile;  
	    var file = Components.classes[cl].createInstance(interf);  
	      
	    // init the file with the path to your ini file  
	    var path = "g:\\temp\\test.opt";  
	    file.initWithPath(path);  
	      
	    // create the nsIINIParserFactory  
	    var cl = "@mozilla.org/xpcom/ini-parser-factory;1";  
	    var interf = Components.interfaces.nsIINIParserFactory;  
	    var iniFact = Components.manager.getClassObjectByContractID(cl,interf);  
	      
	    // get the INIParser for the ini file  
	    var iniParser = iniFact.createINIParser(file);  
		
		var cfgPrefOption={};
		var keyEnum=iniParser.getKeys(section);
		while(keyEnum.hasMore()){
			var key=keyEnum.getNext();
			var value=iniParser.getString(section,key);
			if (value) {
				cfgPrefOption[key] = value;
			}
		}
		
		return cfgPrefOption;
				
	},
	
	prepareAndDoConversion : function(convLst){
		if ((RRprintPages2Pdf.persistLoops + RRprintPages2Pdf.domloaderLoops) > 0) {
			RRprintPages2Pdf.stopPersist = RRprintPages2Pdf.stopDomloader = true;
			var me=this;
			window.setTimeout(function(){me.prepareAndDoConversion(convLst);},100);
			this.processDisp.progress += 10;	
			return;		
		}

		RRprintPages2Pdf.stopPersist = RRprintPages2Pdf.stopDomloader = false;


		this.processDisp.isBusy="running";
		this.updateWindow();		

		this._nsPdfResultFile=null;
		
		if (RRprintPages2Pdf.stopProcessing) {
			this.setToFinish("finish_error");			
			return;
		}
		
		var gPrefOptions=this.getPrefOptions("gopt");
		
		var nsCookieFile=this._workDir.clone();
		nsCookieFile.append("pp2pdfCookie.txt");
		gPrefOptions["load.cookieJar"]=	nsCookieFile.path;
		
		if(window.opener && window.opener.gBrowser && window.opener.gBrowser.selectedBrowser && window.opener.gBrowser.selectedBrowser.contentWindow)
		{
			var win=window.opener.gBrowser.selectedBrowser.contentWindow;
//			gPrefOptions["viewportSize"]= Math.floor(win.innerWidth * window.devicePixelRatio)	 + "x" + Math.floor(win.innerHeight * window.devicePixelRatio);	
			gPrefOptions["viewportSize"]= Math.floor(win.innerWidth)	 + "x" + Math.floor(win.innerHeight);	
			
		}
		else
			gPrefOptions["viewportSize"]= Math.floor(window.screen.width * window.devicePixelRatio)	 + "x" + Math.floor(window.screen.height* window.devicePixelRatio);
		
		if (RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.useScreenDpi") == "true") {
			var domWindowUtils = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
			
//			gPrefOptions["dpi"] = (domWindowUtils.displayDPI * domWindowUtils.screenPixelsPerCSSPixel).toFixed(0).toString();
			gPrefOptions["dpi"] = (domWindowUtils.displayDPI  ).toFixed(0).toString();
		}
		else  {
			var dpi=RRprintPages2Pdf.prefs.getCharPref("wkhtml.gopt.dpi");
			if(dpi != "-1" && dpi != "0") 
				gPrefOptions["dpi"] = dpi;
			else
				gPrefOptions["dpi"] = "-1";
		}
			

		//for debugging purposes
//		gPrefOptions=this.setOptionsFromFile("Global");
		
		
		printPages2Pdf._srcObject.prototype.updatePrefs=this.getWebPageOptPrefs(gPrefOptions);

//		var cpgPrefOption=this.setOptionsFromFile("Object");
		var cpgPrefOption=this.getPrefOptions("oopt");
		cpgPrefOption["outline.titleOnly"]=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.outline.titleOnly");
		cpgPrefOption["pageload.timeout"]=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.pageload.timeout");
			
			
		printPages2Pdf._srcObject.prototype.gPrefOptions=cpgPrefOption;

		if (RRprintPages2Pdf.stopProcessing) {
			this.setToFinish("finish_error");			
			return;
		}


		this.processDisp.progress=100;
		this.processDisp.message="100%";

		var toConvert=new Array();

		var lastDocTitle="page";
		
		for (var i = 0; i < convLst.length; i++) {
			var row = convLst[i];
			var srcObject=row.getUserData("srcObject");
			
			try {
				lastDocTitle=srcObject.Title;
				var finalUrl=srcObject.getFinalUrl();

				toConvert.push({ url: finalUrl,
								 customObjectPrefs: srcObject.getConverterPrefs(),	}
								);

			}catch(e){
				if (RRprintPages2Pdf.stopPersist === true && RRprintPages2Pdf.stopDomloader === true) {
					this.setToFinish("finish_error");
					throw new RRprintPages2Pdf.Exception("doConversion", "cancelall", "Operation cancelled");
				}
				if ((!e.source) || (e.source != "domLoader" && e.source != "persistWin")) {
					this.setToFinish("finish_error");
					throw new RRprintPages2Pdf.Exception("doConversion", "genericerror", e.toString());
				}
			}
			
		}
		if(toConvert.length == 0){
			this.setToFinish("finish_error");			
			return;
		}


		if (RRprintPages2Pdf.stopProcessing) {
			this.setToFinish("finish_error");			
			return;
		}
		
		var convPath="resource://printPages2Pdfscripts/html2pdf.js";
		if(RRprintPages2Pdf.osString == "Linux")
			convPath="resource://printPages2Pdfscripts/html2pdf_linux.js";
		
		
		if (RRprintPages2Pdf.versionChecker.compare(RRprintPages2Pdf.xulAppInfo.platformVersion, "8.0") >= 0) {
			this.pdfWorker = new ChromeWorker(convPath);
		}
		else {
			var workerFactory = Components.classes["@mozilla.org/threads/workerfactory;1"].createInstance(Components.interfaces.nsIWorkerFactory);
			this.pdfWorker = workerFactory.newChromeWorker(convPath);
		}
		
		var me=this;
		this.pdfWorker.onmessage = function(evt){me.observe(evt);};
		
		
		var pdfFile=this.createUserTempDir();
		//pdfFile.append("WebPage.pdf");

		if (RRprintPages2Pdf.stopProcessing) {
			this.pdfWorker.terminate();
			this.pdfWorker=null;
			this.setToFinish("finish_error");			
			return;
		}

		this._ndPdfStopProcessButton.disabled=true;

		if(this._ndMenDocTitle.label)
			gPrefOptions["documentTitle"]=this._ndMenDocTitle.label

		this.convertList(toConvert,pdfFile.path,gPrefOptions,lastDocTitle);
		
	},	
	
	onLoad:function(){
		//so we dont need the hidden window
		printPages2Pdf.domLoader._hiddenWin=window;		
		
		if(window.arguments[1])
			this._prefOverrides=window.arguments[1];
		else
			this._prefOverrides={};
				
		window.focus();
		if (RRprintPages2Pdf.prefs.getBoolPref("processing.startConvImmediately")|| this._prefOverrides.unattended ) {
			var me=this;
			window.setTimeout(function(){me.onActivate();},200);
		}else{
			this.onActivate();
		}

		
	},
	
	addWebPages:function(pagesAr,prefOverrides){
		var txtOnly=false;
		
		if(prefOverrides)
			txtOnly=(this._prefOverrides["g_textOnly"] == true);

		this.onCreateTocChanged();
		
		this.onCreateCoverChanged();

		var firstSrcObject = null;
		for (var i = 0; i < pagesAr.length; i++) {			
			var srcObject=new printPages2Pdf._srcObject(pagesAr[i],txtOnly);
			if(!firstSrcObject) firstSrcObject=srcObject;
			this.UIaddPageItem(srcObject);
			//srcObjects.push(srcObject);
		}
		
		if (!this._ndMenDocTitle.label) {
			if (firstSrcObject) {
				this._ndMenDocTitle.label = firstSrcObject.Title;
				this._ndPdfFileLabel.value = RRprintPages2Pdf.validateFileName(this._ndMenDocTitle.label + ".pdf");
			}
		}
		
	},
	
	onActivate:function(){

		this.domWindowUtils = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
		this.updateWindow();
		//window.focus();

		if (this._workDir) {
			this._workDir.remove(true);
			this.__workDir=null;
		}

		
		if(window.arguments[1])
			this._prefOverrides=window.arguments[1];
		else
			this._prefOverrides={};
		
		this.init();
		
		this.processDisp = new printPages2Pdf._processDisp();

		this.addWebPages(window.arguments[0],window.arguments[1]);
/*
		var txtOnly=(this._prefOverrides["g_textOnly"] == true);
		
		var firstSrcObject=null;
		for (var i = 0; i < window.arguments[0].length; i++) {			
			var srcObject=new printPages2Pdf._srcObject(window.arguments[0][i],txtOnly);
			if(!firstSrcObject) firstSrcObject=srcObject;
			this.UIaddPageItem(srcObject);
			//srcObjects.push(srcObject);
		}

*/		
		this._ndPageList.clearSelection();
						
		//this._ndPdfFileLabel.value=targetFileName;
/*
		this._ndMenDocTitle.label=firstSrcObject.Title;
		this._ndPdfFileLabel.value= RRprintPages2Pdf.validateFileName(this._ndMenDocTitle.label  + ".pdf");

*/
		this.updateWindow();
		if (RRprintPages2Pdf.prefs.getBoolPref("processing.startConvImmediately")|| this._prefOverrides.unattended ) 
			this.start();
	},
	
	start:function() {
		
		this._itemsToProcess = new Array();
		this._itemsProcessed=0;
		this._tocItem=null;
		this._nsPdfResultFiles=new Array();
		
		for (var i = 0; i < this._ndPageList.childNodes.length; i++) {
			var row = this._ndPageList.childNodes[i];
			if (row.getAttribute("hidden") == "true") 
				continue;
			if (row.getAttribute("isToc") == "true" && 
					RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate")) {
				this._tocItem=row;
				continue;
			}
			this._itemsToProcess.push(row);		
		}

		this.startProcess();
	},	
	
	_tocItem:null,
	_itemsProcessed : 0,
	_itemsToProcess : null,
	
	startProcess:function() {
		if(this._itemsProcessed == this._itemsToProcess.length){

			if (RRprintPages2Pdf.prefs.getBoolPref("processing.closeDlgAfterConversion") &&
					RRprintPages2Pdf.prefs.getBoolPref("processing.closeDlgAfterConversion.ask") &&
					!this._prefOverrides.unattended) {
				this.savePdfFileTo();
			}

			
			if (RRprintPages2Pdf.prefs.getBoolPref("processing.closeDlgAfterConversion") 
			 			|| this._prefOverrides.unattended ) {
							window.close();
						}

			return;			
		}
		
		var convLst=this._itemsToProcess;
		if (RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate")) {
			if(this._tocItem)
				convLst = [this._tocItem,this._itemsToProcess[this._itemsProcessed++]];
			else
				convLst = [this._itemsToProcess[this._itemsProcessed++]];
		}
		else 
			this._itemsProcessed = this._itemsToProcess.length;

		this._ndMainTabBox.selectedIndex=0;
		this._ndbrDocavailable.setAttribute("disabled",true);
		RRprintPages2Pdf.stopProcessing=false;
		this.processDisp.startup();
		this.updateWindow();
		
		RRprintPages2Pdf.persistLoops = RRprintPages2Pdf.domloaderLoops =0;
		this._nsPdfResultFile=null;
		
		this._ndStartStopDeck.selectedIndex=1;

		this.processDisp.addRow(0,RRprintPages2Pdf.strb.GetStringFromName("progress.label.preparing"),0,null,null);
		this.processDisp.type = "process";

		try {
			this.prepareAndDoConversion(convLst);
		}catch(e){
			
		}		

	},
	
	updateWindow: function(){
			try {
					  if (this.domWindowUtils != null) 
				  {
				  	this.domWindowUtils.redraw(1);
				  	this.domWindowUtils.processUpdates();
				  }
			} catch (e) {}
	
	},
	
	translateLabel:function(lbl){
		var retVal=lbl.replace(/ *$/,"");
		try{
			retVal=RRprintPages2Pdf.strb.GetStringFromName(retVal);
			
		}catch(ex){}

		return retVal;		
	},
	
	observe: function(event){
		var arg=JSON.parse(event.data);
		switch (arg.type) {
			case "phase_changed":
				if(arg.phase == 6) break; //Done message
				this.processDisp.addRow(arg.phase,this.translateLabel(arg.desc),0,null,null);
				this.processDisp.type = "convert";
				//window.sizeToContent();
				this.updateWindow();
				break;

			case "progress_changed":
				this.processDisp.progress=arg.iProgress;
				if(this.processDisp.status == "none")
					this.processDisp.message=arg.strProgress;
				this.updateWindow();
				break;
			
			case "warning":
				this.processDisp.message=arg.strWarning;
				this.processDisp.status="warning";
				//window.sizeToContent();
				this.updateWindow();
				break;

			case "error":
				this.processDisp.message=arg.strError;
				this.processDisp.status="error";
				//window.sizeToContent();
				this.updateWindow();
				break;
				
			case "finished":
				this.conversionFinished(arg);
				break;
			
		}
	},
	
	saveArrayToFile:function(filePath,data){
		var file = Components.classes["@mozilla.org/file/local;1"].  
	            createInstance(Components.interfaces.nsILocalFile);  
	
	
	    file.initWithPath(filePath);  
	    if (file.exists())  
	      file.remove(true);  
	    file.create(file.NORMAL_FILE_TYPE, 0666);  
	    var fileStream = Components.classes['@mozilla.org/network/file-output-stream;1']  
	                     .createInstance(Components.interfaces.nsIFileOutputStream);  
	    fileStream.init(file, 2, 0x200, false);  
	    var binaryStream = Components.classes['@mozilla.org/binaryoutputstream;1']  
	                       .createInstance(Components.interfaces.nsIBinaryOutputStream);  
	    binaryStream.setOutputStream(fileStream);  
	    binaryStream.writeByteArray(data,data.length);  
	    binaryStream.close();  
	    fileStream.close();  
		
	},
	
	conversionFinished: function(arg){

		this.stopProcessing();
		this._ndPdfStopProcessButton.disabled=false;
		
		//assume conversion correct if file exists
		if(!arg.result){
			var nsiFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			nsiFile.initWithPath(arg.outFile);
			
			if(nsiFile.exists() && nsiFile.fileSize > 0)
				arg.result=true;
			
		}
		
		if (arg.result ) {
			//if pdf data in array save it to file
/*
			if(arg.outArray && arg.outArray.length > 0 )
				this.saveArrayToFile(arg.outFile,arg.outArray);

*/			
			this.setToFinish("finish_success");
			this._nsPdfResultFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			this._nsPdfResultFile.initWithPath(arg.outFile);
			
			var effFileName="";
			var mofl=RRprintPages2Pdf.prefs.getCharPref("processing.maxOutFileLength");
			
			if (RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate") && arg.lastDocTitle) {
				if (mofl > 0 && arg.lastDocTitle.length > mofl)
					effFileName = arg.lastDocTitle.substr(0,mofl);
				else
					effFileName = arg.lastDocTitle;
					
				this._ndPdfFileLabel.value = RRprintPages2Pdf.validateFileName(effFileName + ".pdf");
				
			}
			else if (this._ndMenDocTitle.label) {
				if (mofl > 0 && this._ndMenDocTitle.label.length > mofl)
					effFileName = this._ndMenDocTitle.label.substr(0,mofl);
				else
					effFileName = this._ndMenDocTitle.label;
				this._ndPdfFileLabel.value = RRprintPages2Pdf.validateFileName(effFileName + ".pdf");
			}
			else 
				this._ndPdfFileLabel.value = this._nsPdfResultFile.leafName;

			//get target Path if applicable
			var trgPath=null;

			var strPath=RRprintPages2Pdf.prefs.getCharPref("processing.outputDir");
			if(strPath){
				trgPath = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				trgPath.initWithPath(strPath);
				
				var nsUniqueFile=trgPath.clone();
				nsUniqueFile.append(this._ndPdfFileLabel.value);
				try {
					nsUniqueFile.createUnique(nsUniqueFile.NORMAL_FILE_TYPE, 0666);
					this._ndPdfFileLabel.value=nsUniqueFile.leafName;					
				}catch(e){}
				
			}
			//rename to suggested name
			try {
				this._nsPdfResultFile.moveTo(trgPath, this._ndPdfFileLabel.value);
			}catch(e){
				this._ndPdfFileLabel.value=this._nsPdfResultFile.leafName;
			}

			//save copy to recent Folder
			var libFolder = RRprintPages2Pdf.RecentDir.clone();
			if("libpath" in this._prefOverrides)
			{
				libFolder.initWithPath(this._prefOverrides.libpath)
			}

			var uniqueTarget = libFolder.clone();
			uniqueTarget.append(this._nsPdfResultFile.leafName);
			uniqueTarget.createUnique(uniqueTarget.NORMAL_FILE_TYPE,0777);
			this._nsPdfResultFile.copyTo(libFolder,uniqueTarget.leafName);
			RRprintPages2Pdf.observerService.notifyObservers(uniqueTarget.clone(), "pp2pdf-newlibraryfile", uniqueTarget.path);
			
			this.openPdfResult(this._nsPdfResultFile);
			
			if (this._nsPdfResultFile.exists()) {
				this._ndbrDocavailable.setAttribute("disabled", false);
				this._ndPdfFileLabel.value = this._nsPdfResultFile.leafName;
			}
			//this._ndPdfFileLabel.setAttribute("href",this.printPages2PdfCommonUtils.convertFilePathToURL(this._pdfResultFileName));
			//this._ndPdfSaveButton.disabled=false;
			
		}
		else  		
			this.setToFinish("finish_error");
		
		if (RRprintPages2Pdf.prefs.getBoolPref("archive.preview") )
			this.previewPdf();
		
		if(this._nsPdfResultFile && this._nsPdfResultFiles)
			this._nsPdfResultFiles.push(this._nsPdfResultFile.clone());
/*
		if (RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate") &&
			RRprintPages2Pdf.prefs.getBoolPref("processing.convSeparate.ask"))
			this.saveLastPdfFileTo();
*/
		var me=this;
		window.setTimeout(function(){me.startProcess();},10);
			
	},
	
	previewPdf : function(){
		if((!RRprintPages2Pdf.pdfJsEnabled) ||
				RRprintPages2Pdf.prefs.getBoolPref("processing.closeDlgAfterConversion") )
			return;
		var pBrowser=window.opener.gBrowser;	
		var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		var pdfUrl=IO.newFileURI(this._nsPdfResultFile).spec;		
	
		var newTab=null;
		for(var i=0; i < pBrowser.tabs.length; i++ )
		{
			if(pBrowser.tabs[i].getAttribute("pp2pdfPreview") == "true" )
			{
				newTab=pBrowser.tabs[i];
				break;
			}
		}
		
		if(!newTab)
		{
			newTab=pBrowser.addTab(pdfUrl);	
			newTab.setAttribute("pp2pdfPreview","true");
		}
		else
			pBrowser.getBrowserForTab(newTab).loadURI(pdfUrl);
	   // Focus tab
	    pBrowser.selectedTab = newTab;
	    
	    // Focus *this* browser window in case another one is currently focused
	    pBrowser.ownerDocument.defaultView.focus();	

	},
	
	setToFinish:function(state){
		this._ndPdfStopProcessButton.disabled=false;
		this._ndPdfProcessButton.disabled=false;
		this._ndStartStopDeck.selectedIndex=0;		
		
		this.processDisp.finish(state);
	},
	
	openPdfResult : function(srcFile, bUnconditional){
		if (RRprintPages2Pdf.prefs.getBoolPref("processing.openConvertResult") || bUnconditional == true) {
			var file=null;			
			if (RRprintPages2Pdf.prefs.getBoolPref("processing.closeDlgAfterConversion") )
				file=RRprintPages2Pdf.UserSessionTempDir.clone();
			else
				file=this.createUserTempDir();
			file.append(srcFile.leafName);
			srcFile.copyTo(file.parent,file.leafName);

			
			var pdfViewer=RRprintPages2Pdf.prefs.getCharPref("processing.pdfViewer");
			switch(pdfViewer){
				case "":
				case "[os_default]":
					this.openFileOsDefault(file);
					break;
				case "[open_browser]":
					RRprintPages2Pdf.openInBrowser(file.path);
					break;
				case "[open_directory]":
					this.openFileOsDefault(file.parent);
					break;
				default:
					var executable = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
					try {
						executable.initWithPath(pdfViewer);
						if(executable.exists() && executable.isFile() && executable.isExecutable()){
							var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
							process.init(executable);
							
							var args = [file.path,];
							process.run(false, args, 1);
						}
						else {
							this.openFileOsDefault(file);
						}
					}catch(e){
						this.openFileOsDefault(file);
					}
					break;
			}
		}		
	},

	openFileOsDefault:function(file){
		
		if(!RRprintPages2Pdf.openFileOsDefault(file))
					this.savePdfFileTo();
	},
	
	getPrefOptions:function(branch){
	   var prefs = Components.classes["@mozilla.org/preferences-service;1"]  
	     .getService(Components.interfaces.nsIPrefService)  
	     .getBranch("extensions.RRprintPages2Pdf.wkhtml." + branch + ".");
	
	   
		var obj={};
		var gPrefObj={};
		var children = prefs.getChildList("",obj) ;
	
		for (var i = 0; i < children.length; i++) {
			var prefVal=prefs.getComplexValue(children[i],
     			 Components.interfaces.nsISupportsString).data;
			if (prefVal)
				gPrefObj[children[i]]=prefVal;
		}
			
		return gPrefObj;		
	},
	
	convertList : function(inUrls,outFile,gPrefAr,lastDocTitle){
		this.pdfWorker.postMessage({cmd:"open",
									ExtensionDir: RRprintPages2Pdf.ExtensionDir.path, 
									outFile:outFile,inUrls:inUrls,
									globalPrefs:gPrefAr,  
									lastDocTitle:lastDocTitle,
									is64bit:RRprintPages2Pdf.is64bit,
									});
	

	return;
	
  },
  
  cleanup: function(){

	printPages2Pdf.domLoader.freeResources();
	printPages2Pdf.pageEdit.deinit();
	
	for (var i = this._ndPageList.childNodes.length - 1; i >= 0; i--) { 
		this._ndPageList.childNodes[i].setUserData("srcObject",null,null);
//		this._ndPageList.removeChild(this._ndPageList.childNodes[i]);
	}
	

	try {
		if (this._workDir && this._workDir.exists()) 
			this._workDir.remove(true);
	}
	catch(e){}

  },
  
  lazyClose : function(){
  	if ((RRprintPages2Pdf.persistLoops + RRprintPages2Pdf.domloaderLoops ) <= 0) {
		window.clearInterval(this.closeTimer);
		window.close();
	}
  },
  
  
  onClose : function(event){

	if ((RRprintPages2Pdf.persistLoops + RRprintPages2Pdf.domloaderLoops ) > 0) {
		event.stopPropagation();
		event.preventDefault();
		RRprintPages2Pdf.stopPersist = RRprintPages2Pdf.stopDomloader = true;
		var me=this;
		this.closeTimer=window.setTimeout(function(evt){me.onClose(evt);},100);
	}
	else
		window.close();
  	
  },


  onPrefPopupShowing:function(event){
		if(event.target.id == "objectPrefPopup")
			this._lastPrefPopupTarget=event.explicitOriginalTarget;
			
			var srcObject=this._lastPrefPopupTarget.parentNode.getUserData("srcObject");
			if (!srcObject || !srcObject.customObjectPrefs) {
				printPages2Pdf.prefsUtils.setPrefsFromSys(document);
			}
			else{ 
				printPages2Pdf.prefsUtils.setPrefsFromObject(document, srcObject.customObjectPrefs);
			}
	},

  onBtPrefOk : function(event){
  	var objPrefsAr=printPages2Pdf.prefsUtils.getPrefsObject(document);
	var srcObject=this._lastPrefPopupTarget.parentNode.getUserData("srcObject");
	srcObject.customObjectPrefs=objPrefsAr;
  	document.getElementById("objectPrefPopup").hidePopup();
  },

  onBtPrefCancel : function(event){
  	document.getElementById("objectPrefPopup").hidePopup();
  },

};

printPages2Pdf.processHandler=new printPages2Pdf._processHandler();

printPages2Pdf.eventListener = function(evt){printPages2Pdf.processHandler.onLoad(evt);};

window.addEventListener("unload",function(evt){printPages2Pdf.processHandler.cleanup(evt);},false);
window.addEventListener("close",function(evt){printPages2Pdf.processHandler.onClose(evt);},false);

//window.addEventListener("activate",printPages2Pdf.eventListener,false);
window.addEventListener("load",printPages2Pdf.eventListener,false);

