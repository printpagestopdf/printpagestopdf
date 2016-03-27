Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
Components.utils.import('resource://gre/modules/Services.jsm');


/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};
Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/thumbs.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/archives.jsm",printPages2Pdf);

printPages2Pdf.sbArchive = {
	
	_thumbXadd : 80,
	_thumbYadd : -100,
	_treeNode : null,
	_thumbImage : null,
	_thumbPopup : null,
	_iframe : null,
	_IO : Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),
	str:null,
	bc_arc_cut : null,
	bc_arc_copy : null,
	bc_arc_paste : null,
	bc_arc_open : null,
	bc_arc_delete : null,
	bc_arc_newfolder : null,
	bc_arc_newarchive : null,
	bc_arc_fav : null,
	men_fav:null,
	
	
	
	
	//observer Interface BEGIN
	
	  observe: function(subject, topic, data) {
	     switch(topic){
		 	case "pp2pdf-newlibraryfile":
				var file=subject.QueryInterface(Components.interfaces.nsIFile);
				var idx=this.indexByPath(file.parent.path);
				if (idx >= 0 && idx < this.visibleData.length) {
					var parentObj=this.visibleData[idx];
					if (parentObj.isOpen) {
						var childObj=printPages2Pdf.fsElement.prototype.fromFile(file);
						this.addTreeChild(parentObj,childObj);
					}
					else {
						this.toggleOpenState(idx);
					}
				}
				var newIdx=this.indexByPath(file.path);
				if (newIdx >= 0 && newIdx < this.visibleData.length) 
					this.selection.select(newIdx);
				
				
				break;
			default:
				break;
		 }
	  },
	  
	  register: function() {
	    var observerService = Components.classes["@mozilla.org/observer-service;1"]
	                          .getService(Components.interfaces.nsIObserverService);
	    observerService.addObserver(this, "pp2pdf-newlibraryfile", false);
	  },
	  unregister: function() {
	    var observerService = Components.classes["@mozilla.org/observer-service;1"]
	                            .getService(Components.interfaces.nsIObserverService);
	    observerService.removeObserver(this, "pp2pdf-newlibraryfile");
	  },	
	  
	//observer Interface END

	hideHeader:function(){
		var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow);
				   
		mainWindow.document.getElementById("sidebar-header").style.display = "none";		
	},
	
	
	init : function(){
		//this.hideHeader();
		//Register observer
		this.register();
		
		this._treeNode = document.getElementById("printPages2Pdf.fsTree");
		this._thumbPopup = document.getElementById("thumb-popup");
		this._thumbImage = document.getElementById("thumb-image");	
		this._iframe = document.getElementById("ifrthumb");
		
		this.str=document.getElementById("sbArchiveStrings");
		this.men_fav=document.getElementById("men_fav");

		bc_arc_cut = document.getElementById("printPages2Pdf-bc_arc_cut");
		bc_arc_copy = document.getElementById("printPages2Pdf-bc_arc_copy");
		bc_arc_paste = document.getElementById("printPages2Pdf-bc_arc_paste");
		bc_arc_open = document.getElementById("printPages2Pdf-bc_arc_open");
		bc_arc_delete = document.getElementById("printPages2Pdf-bc_arc_delete");
		bc_arc_newfolder = document.getElementById("printPages2Pdf-bc_arc_newfolder");
		bc_arc_newarchive = document.getElementById("printPages2Pdf-bc_arc_newarchive");
		this.bc_arc_fav = document.getElementById("printPages2Pdf-bc_arc_fav");
		

		this.visibleData = printPages2Pdf.archives.Archives;
		
		this._treeNode.view = printPages2Pdf.sbArchive;
	},
	
	uninit : function(){
		this.unregister();
	},
	
	indexByPath : function(path){
		
		for(var i=0;i < this.visibleData.length;i++){
			if(this.visibleData[i].path == path)
				return i;
		}
		
		return -1;
		
	},
	
	onRemoveArchive:function(objArc){
		if(!RRprintPages2Pdf.confirmDlg(window,RRprintPages2Pdf.strb.GetStringFromName("confirm.delete.title"),
			RRprintPages2Pdf.strb.formatStringFromName("confirm.archivedelete.message",[objArc.name],1))) return;	
		
		printPages2Pdf.archives.remove(objArc);
				
		this.removeTreeChild(objArc);		
	},
	
	onDelete: function(event){
		var objs = this.selectedObjects;
		
		if(objs.length <= 0) return;
		var types=this.containedTypes(objs);
		
		if(objs.length > 1 || types[printPages2Pdf.objType.directory] > 0 ){
			if(!RRprintPages2Pdf.confirmDlg(window,RRprintPages2Pdf.strb.GetStringFromName("confirm.delete.title"),
				RRprintPages2Pdf.strb.GetStringFromName("confirm.objectsdelete.message"))) return;	
		}	
		
		for(var i=objs.length - 1; i >= 0; i--)
		{
			if(objs[i].type == printPages2Pdf.objType.rootDir){
				this.onRemoveArchive(objs[i]);
				continue;
			}
			try{
				var file=objs[i].objFile();
				var imgTrg=RRprintPages2Pdf.getThumbFile(file,"png");

				if(objs[i].isOpen)
					this.toggleOpenState(objs[i].row);
					
				//garbage collection necessary otherwise Dir is locked
				window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				      .getInterface(Components.interfaces.nsIDOMWindowUtils)
				      .garbageCollect();		
				
				
				file.remove(true);
				if(imgTrg != null && imgTrg.exists())
					imgTrg.remove(true);
					
				this.removeTreeChild(objs[i]);	
			}
			catch(e){dump(e);}
		}
		
			
	},
	

	onCut : function(event){
		event.isCut = true;
		this.onCopy(event);
		
	},
		
	onCopy : function(event){
		var objs=this.selectedObjects;
		var isSel=false;
		var trans = RRprintPages2Pdf.Transferable(null);

		
		if(this.selection.currentIndex >= 0 && this.selection.currentIndex < this.visibleData.length ){
			var curItem=this.visibleData[this.selection.currentIndex];
			trans.addDataFlavor("application/x-moz-file");
			trans.setTransferData("application/x-moz-file", curItem.objFile(), 4);
			isSel=true;
		}
		
		var filesAr=new Array();
		var isCut=("isCut" in event && event.isCut)?true:false;
		for (var i = 0; i < objs.length; i++) {
			objs[i].isCut=isCut;
			filesAr.push(objs[i]);
		}
		
		if (filesAr.length > 0) {
			var jsonFiles=JSON.stringify(filesAr);
			trans.addDataFlavor("application/pp2pdf-arc-fsar");
			trans.setTransferData("application/pp2pdf-arc-fsar", RRprintPages2Pdf.SupportsString(jsonFiles), jsonFiles.length * 2);
			isSel=true;
		}
/*		
		trans.addDataFlavor("application/pp2pdf-arc-cutinfo");
		if("isCut" in event && event.isCut)
			trans.setTransferData("application/pp2pdf-arc-fsar", RRprintPages2Pdf.SupportsString(jsonFiles), jsonFiles.length * 2);
		else
	*/	
		if(isSel)
			Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
		
		
	},
	
	onHelp:function(event){
		RRprintPages2Pdf.showHelp("archive");	
	},
	
	onOpen : function(event){
		var objs=this.selectedObjects;
		if(objs.length != 1) return;
		
		RRprintPages2Pdf.openFileOsDefault(objs[0].objFile());
		
	},
	
	onPaste : function(event){
		if(this.selection.currentIndex < 0 || this.selection.currentIndex >= this.visibleData.length ) return;
		
		var parentObj = this.visibleData[this.selection.currentIndex];
		var cpb=Services.clipboard.kGlobalClipboard;
		var trans = RRprintPages2Pdf.Transferable(null);
		var srcObjects=[];
	  	var file = {};
	  	var fileLength = {};
		
      if (Services.clipboard.hasDataMatchingFlavors(["application/pp2pdf-arc-fsar"], 1, cpb)) {
	  	trans.addDataFlavor("application/pp2pdf-arc-fsar");
	  	
	  	Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  	
	  	
	  	trans.getTransferData("application/pp2pdf-arc-fsar", file, fileLength);
	  	if (file) {
	  		var jsonStr = file.value.QueryInterface(Components.interfaces.nsISupportsString).data;
	  		var fileAr = JSON.parse(jsonStr);
	  		for (var i = 0; i < fileAr.length; i++) {
	  		
	  			
				var fObj = printPages2Pdf.fsElement.prototype.fromProps(fileAr[i]);
//				var fObj = this.copyObject(new printPages2Pdf.fsElement(), fileAr[i]);
	  			
	  			this.copyMoveObject(fObj.objFile(), parentObj, fileAr[i].isCut);
	  			if (fileAr[i].isCut) {
	  				this.removeTreeChild(fObj);
	  			}
	  		}
	  	  }
		}		
	  	else 
	  		if (Services.clipboard.hasDataMatchingFlavors(["text/x-moz-place"], 1, cpb)) {
	  			trans = RRprintPages2Pdf.Transferable(null);
	  			trans.addDataFlavor("text/x-moz-place");
	  			Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  			trans.getTransferData("text/x-moz-place", file, fileLength);
	  			if (file) {
	 				var pasteUri = file.value.QueryInterface(Components.interfaces.nsISupportsString).data;
					var placeInfo = JSON.parse(pasteUri);
					this.bookmarksRecursive(placeInfo, srcObjects, true);				  
  				}
	  		}			
	  	else 
	  		if (Services.clipboard.hasDataMatchingFlavors(["text/uri-list"], 1, cpb)) {
	  			trans = RRprintPages2Pdf.Transferable(null);
	  			trans.addDataFlavor("text/uri-list");
	  			Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  			trans.getTransferData("text/uri-list", file, fileLength);
	  			if (file) {
 				  var pasteUri = file.value.QueryInterface(Components.interfaces.nsISupportsString).data;
  				  var srcObject = new printPages2Pdf._srcObjectLight(pasteUri);
				  srcObjects.push(srcObject);	  					
  				}
	  		}
	  	else 
	  		if (Services.clipboard.hasDataMatchingFlavors(["text/x-moz-url"], 1, cpb)) {
	  			trans = RRprintPages2Pdf.Transferable(null);
	  			trans.addDataFlavor("text/x-moz-url");
	  			Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  			trans.getTransferData("text/x-moz-url", file, fileLength);
	  			if (file) {
 				  var pasteUri = file.value.QueryInterface(Components.interfaces.nsISupportsString).data;
  				  var srcObject = new printPages2Pdf._srcObjectLight(pasteUri);
				  srcObjects.push(srcObject);	  					
  				}
	  		}
	  		else 
	  			if (Services.clipboard.hasDataMatchingFlavors(["application/x-moz-file"], 1, cpb)) {
	  				trans = RRprintPages2Pdf.Transferable(null);
	  				trans.addDataFlavor("application/x-moz-file");
	  				Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  				trans.getTransferData("application/x-moz-file", file, fileLength);
	  				if (file) {
	  					file.value.QueryInterface(Components.interfaces.nsILocalFile);
	  					if (this.isConvertable(file.value.leafName)) {
	  						var fileUrl = this._IO.newFileURI(file.value).spec;
	  						var srcObject = new printPages2Pdf._srcObjectLight(fileUrl);
							srcObjects.push(srcObject);
	  						
	  					}
	  					else 
	  						this.copyMoveObject(file.value, parentObj, false);
	  				}
	  			}
	  	else 
	  		if (Services.clipboard.hasDataMatchingFlavors(["text/html"], 1, cpb)) {
	  			trans = RRprintPages2Pdf.Transferable(null);
	  			trans.addDataFlavor("text/html");
	  			Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  			trans.getTransferData("text/html", file, fileLength);
	  			if (file) {
					var fragment = file.value.QueryInterface(Components.interfaces.nsISupportsString).data;
					var html=this.htmlFromFragment(fragment);
					
					var f = RRprintPages2Pdf.createUserTempFile("clipboard.html");

					RRprintPages2Pdf.WriteTextFile(f,html);
  				    var srcObject = new printPages2Pdf._srcObjectLight(this._IO.newFileURI(f).spec);
				    srcObjects.push(srcObject);	  					
					 
	  		     }
		} 
	  	else 
	  		if (Services.clipboard.hasDataMatchingFlavors(["text/plain"], 1, cpb)) {
	  			trans = RRprintPages2Pdf.Transferable(null);
	  			trans.addDataFlavor("text/plain");
	  			Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
	  			trans.getTransferData("text/plain", file, fileLength);
	  			if (file) {
					var pasteUri = file.value.QueryInterface(Components.interfaces.nsISupportsCString).data;
					try {
						var uri=this._IO.newURI(pasteUri, null, null);  //test if text is url
						srcObjects.push(new printPages2Pdf._srcObjectLight(pasteUri));
					} 
					catch(ex){dump(ex);}
	  		}
		} 
				

      if (srcObjects.length > 0) {
           var pars = {};
           pars.g_textOnly = false;
           pars.unattended = true;
           pars.libpath = parentObj.path;
           RRprintPages2Pdf.startConversionDlg(srcObjects, pars, window);
       }

	},
	
	htmlFromFragment:function(fragment){
				var	html = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"> \
<html> \
<head> \
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /> \
</head><body>' + fragment + '</body></html>';
		
		return html;
	},
	
	onCreateFolder : function(){
		var idx=this._treeNode.currentIndex;
		if(idx < 0 ) return;
		
		var item= this.visibleData[idx];
		
		if(item.type != printPages2Pdf.objType.directory && item.type != printPages2Pdf.objType.rootDir) return;
		
		var fsParent = item.objFile();
		fsParent.append("New Folder");
		fsParent.createUnique(fsParent.DIRECTORY_TYPE,0777);
		
		var newItem = printPages2Pdf.fsElement.prototype.fromFile(fsParent);
		this.addTreeChild(item,newItem);
		
		//for(var i = idx + 1; i < this.visibleData.length;i++){
			//var newItem= this.visibleData[i];
			
			if(newItem.path == fsParent.path){
				var col = this._treeNode.columns.getFirstColumn();
		 		this._treeNode.editable=true;
				this._treeNode.startEditing(this.visibleData.indexOf(newItem), col); 
				this._treeNode.editable=false;
				//break;
			}
		//}		
		
	},
	
	onDragStart : function(event){
		var col={};
		var row={}
		var childElt = {};
		this.treeBox.getCellAt(event.clientX, event.clientY , row, col,  childElt);
		if(!childElt.value) return; //drag on scrollbar
		
		var sel = this.selectedIndices;
		for(var i=0; i < sel.length;i++)
		{
			event.dataTransfer.mozSetDataAt("application/x-moz-file",this.visibleData[sel[i]].objFile(), i);
			event.dataTransfer.mozSetDataAt("application/pp2pdf-arc-fs", this.visibleData[sel[i]], i);
			//var p=this.getParentIndex(sel[i]);
			//event.dataTransfer.mozSetDataAt("application/pp2pdf-arc-parent", this.visibleData[p], i);
		}	
		
		event.dataTransfer.effectAllowed="copyMove";	
	},
/*
	onDragOver : function(event){
		event.preventDefault();
	},
	*/
	
	copyMoveObject : function(source, fs, bMove)
	{
		var nsTarget=fs.objFile();
		if (!nsTarget.exists() || !source.exists()) return;
		var imgFile=RRprintPages2Pdf.getThumbFile(source,"png");
		
		
		if (bMove) {
			
			//garbage collection necessary otherwise Dir is locked
			window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			      .getInterface(Components.interfaces.nsIDOMWindowUtils)
			      .garbageCollect();		
			
			source.moveTo(nsTarget, "");
			if(imgFile != null && imgFile.exists())
				imgFile.moveTo(nsTarget, "");

			var fsChild=printPages2Pdf.fsElement.prototype.fromFile(source);
			this.addTreeChild(fs,fsChild);
		}
		else {
			source.copyTo(nsTarget, "");
			if(imgFile != null && imgFile.exists())
				imgFile.copyTo(nsTarget, "");
			
			nsTarget.append(source.leafName);
			var fsChild=printPages2Pdf.fsElement.prototype.fromFile(nsTarget);
			this.addTreeChild(fs,fsChild);
			
	
		}
				
		
	},
	
	
	bookmarksRecursive:function(placeInfo,retAr,bDeep){
		
		if(placeInfo.type == "text/x-moz-place"){
			var srcObject=new printPages2Pdf._srcObjectLight(placeInfo.uri);
			srcObject.Title=placeInfo.title;
			if((placeInfo.annos instanceof Array) && placeInfo.annos.length > 0){
				srcObject.Description=placeInfo.annos[0].value;
			}
			srcObject.sourceType="bookmark";
			retAr.push(srcObject);
			
		}
		
		if(("children" in placeInfo) && bDeep){
			for(var i=0;i < placeInfo.children.length;i++){
				this.bookmarksRecursive(placeInfo.children[i],retAr,bDeep);
			}
		}
	},	
	
	isConvertable:function(filename){
		
		if(filename.search(/\.txt$/i) > -1 ||
			filename.search(/\.htm$/i) > -1 ||
			filename.search(/\.html$/i) > -1 
						)
			return true;
		else
			return false;
		
	},
	
	drop : function(index,orientation,dt){
	  var count = dt.mozItemCount;
	  var srcItems = [];
	  var fsDrop=this.visibleData[index];
	  //this.treeBox.beginUpdateBatch();
  
	  for (var i = 0; i < count; i++) {
	  	/*
	 	var s="";
	  	dump("*******************************\r\n")
		for(var x in dt.mozTypesAt(i)){
			s += dt.mozTypesAt(i)[x] + "\r\n";
		}
		dump(s);			
	  	dump("*******************************\r\n")
		Components.utils.reportError(s );
			*/
		if (dt.mozTypesAt(i).contains("application/x-moz-file")) {
			try {
				var file = dt.mozGetDataAt("application/x-moz-file", i);
				file.QueryInterface(Components.interfaces.nsILocalFile);
				
				if (this.isConvertable(file.leafName)) {
					var fileUrl=this._IO.newFileURI(file).spec;
					var srcObject = new printPages2Pdf._srcObjectLight(fileUrl);
					srcItems.push(srcObject);					
				}
				else {
					if (dt.dropEffect == "move") {
						this.copyMoveObject(file, fsDrop, true);
					}
					else 
						if (dt.dropEffect == "copy") {
							this.copyMoveObject(file, fsDrop, false);
						}
				}
			} 
			catch (ex) {
				dump(ex);
			}
		}
		else if (dt.mozTypesAt(i).contains("text/x-moz-place")) { //bookmark
				var strObj = dt.mozGetDataAt("text/x-moz-place", i);
				var placeInfo = JSON.parse(strObj);
				this.bookmarksRecursive(placeInfo, srcItems, true);
		}				
		else if (dt.mozTypesAt(i).contains("application/x-moz-tabbrowser-tab")) { //browsertab
					var tab = dt.mozGetDataAt("application/x-moz-tabbrowser-tab",i);
					var srcObject=new printPages2Pdf._srcObjectLight(tab.linkedBrowser.contentWindow);
					if(tab.linkedBrowser.contentTitle)
						srcObject.Title=tab.linkedBrowser.contentTitle;
					srcObject.sourceType="browsertab";

					srcItems.push(srcObject);
		}				
		else if (dt.mozTypesAt(i).contains("moz/rdfitem")) { //scrapbook item
			var strId = dt.mozGetDataAt("moz/rdfitem",dropCnt);
			var propsAr = RRprintPages2Pdf.getSbRdfObject(strId, true);
			if (propsAr) {
				for (var i = 0; i < propsAr.length; i++) {
					var srcObject = new printPages2Pdf._srcObjectLight(propsAr[i].location);
					srcObject.Title = propsAr[i].title;
					if (propsAr[i].comment) {
						srcObject.Description = propsAr[i].comment;
					}
					if (propsAr[i].source) 
						srcObject.setOriginUrl(propsAr[i].source);
					
					srcObject.sourceType="scrapbook";
					if(propsAr[i].favIconUrl) srcObject.favIconUrl=propsAr[i].favIconUrl;
					
					srcItems.push(srcObject);
				}
			}
		}				
		else if (dt.mozTypesAt(i).contains("text/uri-list")) { 
			var strUrl = dt.mozGetDataAt("text/uri-list",i);
			try {
				var uri = this._IO.newURI(strUrl, null, null);
				 var url = uri.QueryInterface(Components.interfaces.nsIURL);
				if(url.fileExtension.toLowerCase() == "pdf") 
					this.downloadUrl(url, fsDrop);
				else 
					srcItems.push(new printPages2Pdf._srcObjectLight(strUrl));
			}catch(e){dump(e + "\r\n");}
		}				
		else if (dt.mozTypesAt(i).contains("text/x-moz-url")) { 
			var url = dt.mozGetDataAt("text/x-moz-url",i);
			srcItems.push(new printPages2Pdf._srcObjectLight(url));
		}		
		else if (dt.mozTypesAt(i).contains("text/html")) { 
			var fragment = dt.mozGetDataAt("text/html",i);
			var html=this.htmlFromFragment(fragment);
					
			var f = RRprintPages2Pdf.createUserTempFile("clipboard.html");

			RRprintPages2Pdf.WriteTextFile(f,html);
			var srcObject = new printPages2Pdf._srcObjectLight(this._IO.newFileURI(f).spec);
		    srcItems.push(srcObject);	  					
					 
	  	}
		else if (dt.mozTypesAt(i).contains("text/plain")) { 
			var url = dt.mozGetDataAt("text/plain",i);
			try {
				var uri=this._IO.newURI(url, null, null);  //test if text is url
				srcItems.push(new printPages2Pdf._srcObjectLight(url));
			} 
			catch(ex){}
		}				

				
	}			
  	 // this.treeBox.endUpdateBatch();

  	 // this.treeBox.invalidate();

       
       if (srcItems.length > 0) {
           var pars = {};
           pars.g_textOnly = false;
           pars.unattended = true;
           pars.libpath = fsDrop.path;
           RRprintPages2Pdf.startConversionDlg(srcItems, pars, window);
       }
					
	  
	},
	
	downloadUrl:function(url,parentObj){
		 var oLocalFile = Components.classes["@mozilla.org/file/local;1"]
                       .createInstance(Components.interfaces.nsILocalFile);
        
  		oLocalFile.initWithPath(parentObj.path);
		oLocalFile.append(url.fileName);
		var me=this;
		var oDownloadObserver = 
		{ 
			onDownloadComplete: function(nsIDownloader, nsresult, oFile){ 
				if(oFile && oFile.exists()){
					var objFile=printPages2Pdf.fsElement.prototype.fromFile(oFile);
					me.addTreeChild(parentObj,objFile);
				}
			}
		};

		var oDownloader = Components.classes["@mozilla.org/network/downloader;1"].createInstance();
		oDownloader.QueryInterface(Components.interfaces.nsIDownloader);
		oDownloader.init(oDownloadObserver, oLocalFile);
		
		//var oHttpChannel = this._IO.newChannel(url, "", null);
		var oHttpChannel = this._IO.newChannelFromURI(url);
		oHttpChannel.QueryInterface(Components.interfaces.nsIHttpChannel);
		oHttpChannel.asyncOpen(oDownloader, oLocalFile); 		
				
	},

/*	
	onDrop : function(event)
	{
	  var data = event.dataTransfer.getData("text/plain");
	  alert(data);
	  event.preventDefault();
	},	
	*/
	onDragEnd : function(event){
		var dt=event.dataTransfer;
		if(dt.dropEffect != "copy" && 
					dt.types.contains("application/pp2pdf-arc-fs")){
		  var count = dt.mozItemCount;
		  for (var i = 0; i < count; i++) {
		  	if(dt.mozTypesAt(i).contains("application/pp2pdf-arc-fs"))
			{
				var fs = dt.mozGetDataAt("application/pp2pdf-arc-fs", i);
				if(!fs.objFile().exists())
					this.removeTreeChild(fs);
			}
		  }
		}
/*
	const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
	                                   .getService(Components.interfaces.nsIClipboardHelper);
	gClipboardHelper.copyString(strOut);*/		
	
	},
	
	canDrop:function(index,orientation,dataTransfer){
		var retVal=false;
	    var item = this.visibleData[index];
		if (item.type == printPages2Pdf.objType.rootDir || item.type == printPages2Pdf.objType.directory )
			retVal=true;
			
		dataTransfer.effectAllowed="copyMove";
		return retVal;
	},
	
	
	onCreateArchive : function(){
		var filePicker = Components.classes["@mozilla.org/filepicker;1"]
	                 .createInstance(Components.interfaces.nsIFilePicker);
		var mode=filePicker.modeGetFolder;
		
		var path=RRprintPages2Pdf.HomeDir;
		filePicker.displayDirectory=path;
			
		filePicker.init(window,"Select/Create Archive Folder",mode);
		
		var retVal=filePicker.show();
		
		if(retVal == filePicker.returnCancel || filePicker.file == null ) return;

		var f=printPages2Pdf.archives.add(filePicker.file);
		
		var idx=this.visibleData.push(f)
        this.treeBox.rowCountChanged(idx, 1);
	    this.treeBox.invalidateRow(idx - 1);
		
	},
	/*
	 * parent: fsElement or index
	 * child: fsElement
	 */
	addTreeChild : function(parent,child){
		var idxParent = -1;
		var objParent = null;
		if ("isOpen" in parent) { //is fsElement object
			idxParent = this.visibleData.indexOf(parent);
			if(idxParent < 0 || idxParent >= this.visibleData.length) return false;
			objParent = parent;
		}
		else{
			idxParent = parent;
			if(idxParent < 0 || idxParent >= this.visibleData.length) return false;
			objParent = this.visibleData[idxParent];
		}
		
		if(!objParent.isOpen){
			this.treeBox.invalidateRow(idxParent);		
			return;
		}
			
		var idxChild=idxParent + 1;
		for(; idxChild < this.visibleData.length && 
				this.visibleData[idxChild].level > objParent.level;idxChild++)
			if(this.visibleData[idxChild].path == child.path) return;	
		
		child.level = objParent.level + 1;
		this.visibleData.splice(idxChild, 0, child);
		
     	this.treeBox.rowCountChanged(idxChild, 1);
    
    	this.treeBox.invalidateRow(idxChild);		
	},
	
	removeTreeChild : function(child){
		
//		var idxChild=this.visibleData.indexOf(child);
		var idxChild=this.indexByPath(child.path);
		if(idxChild < 0 || idxChild >= this.visibleData.length) return;
		
/*
		var children = 0;
		for(var i=idxChild + 1; i < this.visibleData.length && 
								this.visibleData[i].level < child.level;i++, children++);
*/
		if(child.isOpen)
			this.toggleOpenState(idxChild);
		
		this.visibleData.splice(idxChild, 1);
		
     	this.treeBox.rowCountChanged(idxChild,-1);
    
    	this.treeBox.invalidateRow(idxChild);		
	},
	
	onContextMenu : function(event){
	
	  // get the row, col and child element at the point
	  var row = { }, col = { }, child = { };
	  alert(event.sourceEvent + ":" + event.clientX + "  " + event.clientY);
	  this.treeBox.getCellAt(event.clientX, event.clientY, row, col, child);
	
	  var cellText = this.getCellText(row.value, col.value);
	  alert(cellText);		
	},
	
	openWindow : function(aParent, aURL, aTarget, aFeatures, aArgs) {
	  var args = Components.classes["@mozilla.org/supports-array;1"]
	                       .createInstance(Components.interfaces.nsICollection);
	
	  while (aArgs && aArgs.length > 0) {
	    var arg = aArgs.shift();
	
	    var argstring =
	      Components.classes["@mozilla.org/supports-string;1"]
	                .createInstance(Components.interfaces.nsISupportsString);
	
	    argstring.data = arg? arg : "";
	
	    args.AppendElement(argstring);
  }

	  var win = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
	                   .getService(Components.interfaces.nsIWindowWatcher)
	                   .openWindow(aParent, aURL, aTarget, aFeatures, args);
					   
	  win.gFindBar={};

	},
	


	onMouseLeave : function(event){
		this._thumbPopup.hidePopup();
	},
	
	_clientX:-1,
	_clientY:-1,
	
	onMouseMove : function(event){
		if (RRprintPages2Pdf.prefs.getBoolPref("archive.showthumbs") === false) return;

		this._clientX=event.clientX;
		this._clientY=event.clientY;
		if(!RRprintPages2Pdf.pdfJsEnabled) return;
		if(this._treeNode.editingRow != -1) return;
		
	  	var r={};
		var c={};
		var elm={};
		this.treeBox.getCellAt(event.clientX, event.clientY, r, c, elm);
		
		if(this._thumbPopup.state == "open"){
			this._thumbPopup.moveTo(event.screenX + this._thumbXadd,event.screenY + this._thumbYadd);
		}
		//alert(c.value.index);
		if(elm.value != "text")  	
		{
			this._thumbPopup.hidePopup();
			return;
		} 
		
		var row=r.value;
		
		if (row < 0 || row >= this.visibleData.length || 
				this._treeNode.editingRow == row)
		{
			this._thumbPopup.hidePopup();
			return;
		} 
		if((this._thumbImage.row) && this._thumbImage.row == row && this._thumbPopup.state == "open"){
			return;
		}
		this._thumbImage.row = row;
		if(this._thumbPopup.state == "open")
			this._thumbPopup.hidePopup();
		
		var obj = this.visibleData[row];
		
		if (obj.type != printPages2Pdf.objType.pdf)
		{
			this._thumbPopup.hidePopup();
			return;
		} 
		
		var srcFile=obj.objFile();		
		var imgTrg=RRprintPages2Pdf.getThumbFile(srcFile,"png");
		
		var objArgs={X:event.screenX, Y:event.screenY};
		
		if(imgTrg != null && (!imgTrg.exists())) {		
			this._thumbImage.src="chrome://printPages2Pdf/skin/icon_loading_75x75.gif";
			this._thumbPopup.openPopupAtScreen(event.screenX + this._thumbXadd,event.screenY + this._thumbYadd, false);
			printPages2Pdf._thumbs.prototype.create(this._iframe,srcFile, this, objArgs);
			return;
		}
		
		this.displayThumb(imgTrg,objArgs);
		//dump("TAG:" + event.relatedTarget.tagName + "\r\n");
		return;
	},
	
	onMouseLeave : function(){
		if(this._thumbPopup)
			this._thumbPopup.hidePopup();
	},
	
	displayThumb : function(imageFile,objArgs){
		var pdfUrl=this._IO.newFileURI(imageFile).spec;			
		this._thumbImage.src=pdfUrl;

		if (this._thumbPopup.state == "open") {
			this._thumbPopup.moveTo(objArgs.X + this._thumbXadd,objArgs.Y + this._thumbYadd);
		}
		else
			this._thumbPopup.openPopupAtScreen(objArgs.X + this._thumbXadd,objArgs.Y + this._thumbYadd, false);

	},
	
	testButton : function(){
		var dirService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
		var dir = dirService.get("Pers", Components.interfaces.nsILocalFile);
		alert(dir.path);
		return;
		var pdf=this.selectedObjects[0].objFile();
		var tb = new printPages2Pdf._thumbs(document,[pdf,],null);
		
		var thumbPopup = document.getElementById("thumb-popup");
		thumbPopup.openPopup(this._treeNode, "after_start", 0, 0, false, false);
		return;
		var frame=document.getElementById("pdfframe");
		frame.setAttribute("src","");
		frame.setAttribute("src","chrome://printPages2Pdf/content/thumbs.html");
		return;
		
	var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
	                   .getInterface(Components.interfaces.nsIWebNavigation)
	                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
	                   .rootTreeItem
	                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
	                   .getInterface(Components.interfaces.nsIDOMWindow);
	
	var target=mainWindow.getBrowser().selectedBrowser.contentWindow.location.href;		
      this.openWindow(null, "chrome://cmdlnprint/content/mininav.xul", "_blank",
                 "menubar=yes,toolbar=yes,all",
                [target, "2", "C:\\out.png", "", ""]);		
		return;
		var tree=this._treeNode;
		var col = tree.columns.getFirstColumn();
//		setTimeout(function() { tree.view.selection.select(1); tree.startEditing(1, col); }, 0);	},
		tree.editable=true;
		/*tree.view.selection.select(1);*/ 
		tree.startEditing(1, col); 
		tree.editable=false;
		},
	

 
  visibleData : [],
 
  treeBox: null,
  selection: null,
 
  get rowCount()                     { return this.visibleData.length; },
  setTree: function(treeBox)         { this.treeBox = treeBox; },
  getCellText: function(idx, column) { return this.visibleData[idx].name; },
  isContainer: function(idx)         
  		{ return (this.visibleData[idx].type == printPages2Pdf.objType.directory || 
  						this.visibleData[idx].type == printPages2Pdf.objType.rootDir); },
  isContainerOpen: function(idx)     { return this.visibleData[idx].isOpen; },
  isContainerEmpty: function(idx)    
  { 
    var fs=this.visibleData[idx].objFile();
	var retVal=true;
	try {
		retVal = !fs.directoryEntries.hasMoreElements();
	}
	catch(ex){}
	
	return retVal;
  },
  isSeparator: function(idx)         { return false; },
  isSorted: function()               { return false; },
  isEditable: function(idx, column)  {
	 return true; 
	},
  
  setCellText : function(row,col,value){
	  	var item = this.visibleData[row];
		if(item.name == value) return;

		if (item.type == printPages2Pdf.objType.rootDir) {			
			item.name = value;
			printPages2Pdf.archives.saveArchives();
			return ;
		};

		
		try{
			var nsFile=item.objFile();
			var imgFile=RRprintPages2Pdf.getThumbFile(nsFile,"png");			
			var nsNewFile=nsFile.clone();
			nsNewFile.leafName=value;
			if (nsNewFile.exists()) throw "Name already exists";

			//garbage collection necessary otherwise Dir is locked
			window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			      .getInterface(Components.interfaces.nsIDOMWindowUtils)
			      .garbageCollect();		

			nsFile.moveTo(null,nsNewFile.leafName);
			if(imgFile != null && imgFile.exists()){
				var imgFileNew=RRprintPages2Pdf.getThumbFile(nsFile,"png");
				if (imgFileNew != null) {
					imgFile.moveTo(null, imgFileNew.leafName);					
				}
			}
			
			//if archive save update archives
			if(item.type == printPages2Pdf.objType.rootDir)
				printPages2Pdf.archives.replace(item,nsFile);
					
			item.name = nsFile.leafName;
			item.path = nsFile.path;
		}
		catch(e)
		{
			dump(e);			
		}
		
  },

 
  getParentIndex: function(idx) {
	var lvl = this.getLevel(idx);
	
    for (var t = idx - 1; t >= 0 ; t--) {
      if (this.isContainer(t) && this.getLevel(t) < lvl ) return t;
    }
	
	return -1;
  },
  
  getLevel: function(idx) {
  	 if(idx < 0 || idx >= this.visibleData.length) return -1;
     var item = this.visibleData[idx];
	 return item.level;
  },
  
  hasNextSibling: function(idx, after) {
    var thisLevel = this.getLevel(idx);
    for (var t = after + 1; t < this.visibleData.length; t++) {
      var nextLevel = this.getLevel(t);
      if (nextLevel == thisLevel) return true;
      if (nextLevel < thisLevel) break;
    }
    return false;
  },
  
  toggleOpenState: function(idx) {
	if(idx < 0 || idx >= this.visibleData.length) return;
  	
    var item = this.visibleData[idx];
    //if (!item[1]) return;
 
    if (item.isOpen) {
      item.isOpen = false;
 
      var thisLevel = this.getLevel(idx);
      var deletecount = 0;
      for (var t = idx + 1; t < this.visibleData.length; t++) {
        if (this.getLevel(t) > thisLevel) deletecount++;
        else break;
      }
      if (deletecount) {
        this.visibleData.splice(idx + 1, deletecount);
        this.treeBox.rowCountChanged(idx + 1, -deletecount);
      }
    }
    else {
      item.isOpen = true;

	var file = Components.classes["@mozilla.org/file/local;1"].
           	createInstance(Components.interfaces.nsILocalFile);

 	file.initWithPath(item.path);	

	var entries = file.directoryEntries;
	var i=0;
	while(entries.hasMoreElements())
	{
		try {
		   var entry = entries.getNext();
		   //if(!entry) break; //XPCOMM error???
	  		entry.QueryInterface(Components.interfaces.nsIFile);
			if(entry.leafName.search(/^\./) != -1) continue;
			/*
			var f=new printPages2Pdf.fsElement();
			f.type = entry.isDirectory()?printPages2Pdf.objType.directory:(entry.leafName.search(/.pdf$/i) > -1?printPages2Pdf.objType.pdf:printPages2Pdf.objType.other);
			f.path=entry.path;
			f.name = entry.leafName;
			*/
			var f=printPages2Pdf.fsElement.prototype.fromFile(entry);
			f.level = item.level + 1;
        	this.visibleData.splice(idx + i + 1, 0, f);
			i = i + 1;
		}
		catch(e) {dump(e + "\r\n");};
	}

      this.treeBox.rowCountChanged(idx + 1, i);
    }
    this.treeBox.invalidateRow(idx);
  },
 
 	get selectedIndices() {
		var ret=new Array();		

		var start = new Object();
		var end = new Object();
		var numRanges = this.selection.getRangeCount();
		
		for (var t = 0; t < numRanges; t++){
		  this.selection.getRangeAt(t,start,end);
		  for (var v = start.value; v <= end.value; v++){
		    ret.push(v);
		  }
		}  
		return ret;
	},

 
	get selectedObjects() {
		var ret=new Array();		

		var start = new Object();
		var end = new Object();
		var numRanges = this.selection.getRangeCount();
		
		for (var t = 0; t < numRanges; t++){
		  this.selection.getRangeAt(t,start,end);
		  for (var v = start.value; v <= end.value; v++){
		  	this.visibleData[v].row=v;			
		    ret.push(this.visibleData[v]);
		  }
		}  
		return ret;
	},

	onSetFavorite:function(){
		if(this.selection.currentIndex < 0 || this.selection.currentIndex >= this.visibleData.length ) return;
		
		var obj = this.visibleData[this.selection.currentIndex];
		
		if(this.men_fav.hasAttribute("checked"))
			printPages2Pdf.arcFavorites.add(obj.path);
		else
			printPages2Pdf.arcFavorites.remove(obj.path);
				
	},

	onPopupShowing : function(event){
		var objs=this.selectedObjects;
		
		if(objs.length = 1 && 
		    ( objs[0].type == printPages2Pdf.objType.rootDir ||
		      objs[0].type == printPages2Pdf.objType.directory ) &&
			  objs[0].isFavorite()	){
			  	this.men_fav.setAttribute("checked","true");
		}
		else
			  	this.men_fav.removeAttribute("checked");
						
	},

  _lastRowClick : -1,
  
  onRename:function(event){
  	var row=-1;
	var idxs=this.selectedIndices;
	for(var i=0; i < idxs.length;i++){
		if (!this.visibleData[idxs[i]].isSpecial) {
			row=idxs[i];
			break;
		}
	}
	if(this._treeNode.editingRow == row ) return;
	
	var col = this._treeNode.columns.getFirstColumn();
	
	this._treeNode.editable = true;
	this._treeNode.startEditing(row, col);
	this._treeNode.editable = false;
	 	
  },
  
  onClick : function(event){
 	var row = this.treeBox.getRowAt(event.clientX,event.clientY);
	if(this._treeNode.editingRow == row ) return;
	
  	var r={};
	var c={};
	var elm={};
	this.treeBox.getCellAt(event.clientX, event.clientY, r, c, elm);

	
	if(row >= 0 && row == this._lastRowClick){
		if (elm.value == "text" && event.button == 0 ) {
			if(this.visibleData[row].isSpecial) return;
			this._lastRowClick = row;
			
			if (this._thumbPopup.state == "open") 
				this._thumbPopup.hidePopup();
			
			var col = this._treeNode.columns.getFirstColumn();
			
			this._treeNode.editable = true;
			this._treeNode.startEditing(row, col);
			this._treeNode.editable = false;
			return;
		}	
	}
	
	this._lastRowClick = row;
	 	

	if ((elm.value == "image" || elm.value == "text") && event.button == 0) {
		if (row >= 0 && row < this.visibleData.length)
			this.doRowAction(this.visibleData[row]);
		
	}
  },
  
  doRowAction : function(fsObj){
	if (fsObj.type != printPages2Pdf.objType.directory && fsObj.type != printPages2Pdf.objType.rootDir) {
		if(RRprintPages2Pdf.pdfJsEnabled)
			RRprintPages2Pdf.openInBrowser(fsObj.path);
		else
			RRprintPages2Pdf.openFileOsDefault(fsObj.objFile());
		
	}
	else 
		if ((fsObj.type == printPages2Pdf.objType.directory || fsObj.type == printPages2Pdf.objType.rootDir) &&
		(RRprintPages2Pdf.pdfJsEnabled)) {
			this.openAndReuseOneTabPerAttribute("printpages2pdf_dirthumbs", "chrome://printPages2Pdf/content/dirlister.html?dir=" + encodeURIComponent(fsObj.path));
		}
  },
  
 
	openAndReuseOneTabPerAttribute : function(attrName, url) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		                 .getService(Components.interfaces.nsIWindowMediator);
		for (var found = false, index = 0, tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
		   index < tabbrowser.tabContainer.childNodes.length && !found;
		   index++) {
		
			// Get the next tab
			var currentTab = tabbrowser.tabContainer.childNodes[index];
			
			// Does this tab contain our custom attribute?
			if (currentTab.hasAttribute(attrName)) {
			
			  // Yes--select and focus it.
			  tabbrowser.selectedTab = currentTab;
			
				var newTabBrowser = tabbrowser.getBrowserForTab(currentTab);
				newTabBrowser.loadURI(url);
				
			  // Focus *this* browser window in case another one is currently focused
			  tabbrowser.ownerDocument.defaultView.focus();
			  found = true;
			}
		}
		
		if (!found) {
			// Our tab isn't open. Open it now.
			var browserEnumerator = wm.getEnumerator("navigator:browser");
			var tabbrowser = browserEnumerator.getNext().gBrowser;
			
			// Create tab
			var newTab = tabbrowser.addTab(url);
			newTab.setAttribute(attrName, "xyz");
			
			// Focus tab
			tabbrowser.selectedTab = newTab;
			 
			// Focus *this* browser window in case another one is currently focused
			tabbrowser.ownerDocument.defaultView.focus();
		}
	},
  
  doCommand : function(cmd){
		var start = new Object();
		var end = new Object();
		var numRanges = this.selection.getRangeCount();
		var strOut="";
		var objs=this.selectedObjects;
		for(o in objs)
		    strOut += objs[o].path + "\r\n";

		alert(strOut);
	},
	
  
  getImageSrc: function(idx, column) 
  {
    var item = this.visibleData[idx];
 	if (item.type == printPages2Pdf.objType.directory && item.isOpen)
	  	return "chrome://printPages2Pdf/skin/folderOpen.png";
 	else if(item.type == printPages2Pdf.objType.directory && !item.isOpen)
	  	return "chrome://printPages2Pdf/skin/folderClosed.png";
	else if (item.type == printPages2Pdf.objType.rootDir)
  		return "chrome://printPages2Pdf/skin/drawer16.png";
	else if (item.type == printPages2Pdf.objType.pdf)
  		return "chrome://printPages2Pdf/skin/document_pdf.png";
	else
  		return "chrome://printPages2Pdf/skin/treeicon.png";
  },
  getProgressMode : function(idx,column) {},
  getCellValue: function(idx, column) {},
  cycleHeader: function(col, elem) {},
  /*selectionChanged: function() {},*/
	
  containedTypes:function(arObjects){
  	var arRet=new Array();
	for(var x in printPages2Pdf.objType){
		arRet[printPages2Pdf.objType[x]] =0;	
	}
	
	for(var i=0;i < arObjects.length;i++){
		arRet[arObjects[i].type]++
	}	
	
	return arRet;
  },
  
  selectionChanged: function(event) {
		var objs=this.selectedObjects;
		var currentRow = this.treeBox.getRowAt(this._clientX,this._clientY);
		
		if (objs.length <= 0) {
			bc_arc_cut.setAttribute("disabled", "true");
			bc_arc_copy.setAttribute("disabled", "true");
			bc_arc_paste.setAttribute("disabled", "true");
			bc_arc_open.setAttribute("disabled", "true");
			bc_arc_delete.setAttribute("disabled", "true");
			bc_arc_newfolder.setAttribute("disabled", "true");
			bc_arc_newarchive.setAttribute("disabled", "false");
			this.bc_arc_fav.setAttribute("disabled", "true");
			return;
		}

		if (objs.length == 1) {
				if(objs[0].isSpecial){
					bc_arc_cut.setAttribute("disabled", "true");
					bc_arc_copy.setAttribute("disabled", "false");
					bc_arc_paste.setAttribute("disabled", "false");
					bc_arc_open.setAttribute("disabled", "false");
					bc_arc_delete.setAttribute("disabled", "true");
					bc_arc_newfolder.setAttribute("disabled", "false");
					bc_arc_newarchive.setAttribute("disabled", "false");
					this.bc_arc_fav.setAttribute("disabled", "false");
					return;
				}
				switch(objs[0].type){
					case printPages2Pdf.objType.directory:
						bc_arc_cut.setAttribute("disabled", "false");
						bc_arc_copy.setAttribute("disabled", "false");
						bc_arc_paste.setAttribute("disabled", "false");
						bc_arc_open.setAttribute("disabled", "false");
						bc_arc_delete.setAttribute("disabled", "false");
						bc_arc_newfolder.setAttribute("disabled", "false");
						bc_arc_newarchive.setAttribute("disabled", "true");
						this.bc_arc_fav.setAttribute("disabled", "false");
						break;
					case printPages2Pdf.objType.rootDir:
						bc_arc_cut.setAttribute("disabled", "true");
						bc_arc_copy.setAttribute("disabled", "false");
						bc_arc_paste.setAttribute("disabled", "false");
						bc_arc_open.setAttribute("disabled", "false");
						bc_arc_delete.setAttribute("disabled", "false");
						bc_arc_newfolder.setAttribute("disabled", "false");
						bc_arc_newarchive.setAttribute("disabled", "false");
						this.bc_arc_fav.setAttribute("disabled", "false");
						break;
					case printPages2Pdf.objType.pdf:
					case printPages2Pdf.objType.other:
						bc_arc_cut.setAttribute("disabled", "false");
						bc_arc_copy.setAttribute("disabled", "false");
						bc_arc_paste.setAttribute("disabled", "true");
						bc_arc_open.setAttribute("disabled", "false");
						bc_arc_delete.setAttribute("disabled", "false");
						bc_arc_newfolder.setAttribute("disabled", "true");
						bc_arc_newarchive.setAttribute("disabled", "true");
						this.bc_arc_fav.setAttribute("disabled", "true");
						break;
					default:
						bc_arc_cut.setAttribute("disabled", "true");
						bc_arc_copy.setAttribute("disabled", "true");
						bc_arc_paste.setAttribute("disabled", "true");
						bc_arc_open.setAttribute("disabled", "true");
						bc_arc_delete.setAttribute("disabled", "true");
						bc_arc_newfolder.setAttribute("disabled", "true");
						bc_arc_newarchive.setAttribute("disabled", "true");
						this.bc_arc_fav.setAttribute("disabled", "true");
						break;
				}
				return;
			}
  		//multiselection
		var types=this.containedTypes(objs);
		
		if(types[printPages2Pdf.objType.rootDir] == 0){
			bc_arc_cut.setAttribute("disabled", "false");
			bc_arc_copy.setAttribute("disabled", "false");
			bc_arc_paste.setAttribute("disabled", "true");
			bc_arc_open.setAttribute("disabled", "true");
			bc_arc_delete.setAttribute("disabled", "false");
			bc_arc_newfolder.setAttribute("disabled", "true");
			bc_arc_newarchive.setAttribute("disabled", "true");
			this.bc_arc_fav.setAttribute("disabled", "true");
		}
		else{
			bc_arc_cut.setAttribute("disabled", "true");
			bc_arc_copy.setAttribute("disabled", "false");
			bc_arc_paste.setAttribute("disabled", "true");
			bc_arc_open.setAttribute("disabled", "true");
			bc_arc_delete.setAttribute("disabled", "true");
			bc_arc_newfolder.setAttribute("disabled", "true");
			bc_arc_newarchive.setAttribute("disabled", "true");
			this.bc_arc_fav.setAttribute("disabled", "true");
		}

  },

  cycleCell: function(idx, column) {},
  performAction: function(action) {},
  performActionOnCell: function(action, index, column) {},
  getRowProperties: function(idx) {},
  getCellProperties: function(idx, column) {},
  getColumnProperties: function(column, element) {},	
}



function dataProvider(){}
 
dataProvider.prototype = {
  QueryInterface : function(iid) {
		   Components.utils.reportError("iid : " + iid );
   		
    //if (iid.equals(Components.interfaces.nsIFlavorDataProvider)
      //            || iid.equals(Components.interfaces.nsISupports))
      return this;
   // throw Components.results.NS_NOINTERFACE;
  },
  
  __noSuchMethod__ : function(name, args) {
    Components.utils.reportError("calling non-existent method : " + name);
  },  
  
  getFlavorData : function(aTransferable, aFlavor, aData, aDataLen) {
	   Components.utils.reportError("getFlavorData : " + aFlavor );
/*	   
       var f =  Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
       f.initWithPath("C:\\dout.txt");
       f.createUnique(f.NORMAL_FILE_TYPE, 0666);

    if (aFlavor == 'application/x-moz-file-promise') {
	
       var urlPrimitive = {};
       var dataSize = {};
   
       aTransferable.getTransferData('application/x-moz-file-promise-url', urlPrimitive, dataSize);
       var url = new String(urlPrimitive.value.QueryInterface(Components.interfaces.nsISupportsString));
       console.log("URL file orignal is = " + url);
       
       var namePrimitive = {};
       aTransferable.getTransferData('application/x-moz-file-promise-filename', namePrimitive, dataSize);
       var name = new String(namePrimitive.value.QueryInterface(Components.interfaces.nsISupportsString));
   
       console.log("target filename is = " + name);
   
       var dirPrimitive = {};
       aTransferable.getTransferData('application/x-moz-file-promise-dir', dirPrimitive, dataSize);
       var dir = dirPrimitive.value.QueryInterface(Components.interfaces.nsILocalFile);
   
       console.log("target folder is = " + dir.path);
   
       var file =  Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
       file.initWithPath(dir.path);
       file.appendRelativePath(name);
   
       console.log("output final path is =" + file.path);
   
    }
    */
  }
}
