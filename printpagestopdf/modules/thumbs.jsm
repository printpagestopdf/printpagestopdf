Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 


var EXPORTED_SYMBOLS = [ "_thumbs", ];


/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/domLoader.jsm",printPages2Pdf);


/*
_thumbs = function(doc,pdfList,callback,objArgs) {
	this._doc = doc;
	this._pdfList = pdfList;
	this._cb = callback;
	this._objArgs = objArgs;
	this.createThumbs();
}	
	*/
_thumbs = function(frame) {
	this.iframe = frame;
}	
	
_thumbs.prototype = {
	iframe_id : "ifrthumb",
	iframe : null,
	procList : new Array(),
	frameLoaded : false,
	processing : false,
	
	create : function(frame,pdfFile,callback,objArgs){ //should be called static (.prototype.....
		if(!frame.objProc)
			frame.objProc=new _thumbs(frame);
		
		frame.objProc.process(pdfFile,callback,objArgs);
	},
	
	process : function(pdfFile,callback,objArgs){
		var proc={pdfFile:pdfFile,callback:callback,objArgs:objArgs};
		this.procList.push(proc);

		if(!this.frameLoaded){
			var src=this.iframe.getAttribute("src");
			if ((!src) || src != "chrome://printPages2Pdf/content/thumbs.html") {
				this.iframe.setAttribute("src", "chrome://printPages2Pdf/content/thumbs.html");
			}
		}
		
		this.execCreate();			
	},
	
	frameReady : function(){
		this.frameLoaded=true;
		this.execCreate();
	},

	webPageLoaded:function(step,args){
				RRprintPages2Pdf.bcs.log("STEP ",step);
	},
	
	execCreate : function(){		
		if(this.procList.length <= 0 || this.processing === true || this.frameLoaded === false ) return;
		this.processing=true;

		var proc=this.procList.pop();
		var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		var pdfUrl=IO.newFileURI(proc.pdfFile).spec;

/*
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
		                   .getService(Components.interfaces.nsIWindowMediator);  
		var mainWindow = wm.getMostRecentWindow("navigator:browser"); 
		printPages2Pdf.domLoader._parentWin=mainWindow;
		RRprintPages2Pdf.bcs.log("WINDOW ",pdfUrl);
		var win = printPages2Pdf.domLoader.getContentWindow(pdfUrl,this.webPageLoaded,2000000);
*/

		var imgTrg=RRprintPages2Pdf.getThumbFile(proc.pdfFile,"png");
			
		var scale=RRprintPages2Pdf.prefs.getCharPref("archive.thumbsquality");
		scale=Math.round(scale) / 100;
		var data=this.arrayFromFile(proc.pdfFile);
		var obj={pdfSrc:data, trgFile:imgTrg,controller:this, callback:proc.callback,objArgs:proc.objArgs,scale:scale};	
		this.iframe.contentWindow.loadPDF(obj);
		
	},
	
	arrayFromFile : function(_nsFile){
		
		var BASE64_MARKER = ';base64,';
		
		dataURI=this.generateDataURI(_nsFile);
		
		var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
		var base64 = dataURI.substring(base64Index);
		var raw = atob(base64);
		var rawLength = raw.length;
		var array = new Uint8Array(new ArrayBuffer(rawLength));
		
		for(i = 0; i < rawLength; i++) {
		array[i] = raw.charCodeAt(i);
		}
		return array;
		
	},
	
	generateDataURI :function(file) {
	  var contentType = Components.classes["@mozilla.org/mime;1"]
	                              .getService(Components.interfaces.nsIMIMEService)
	                              .getTypeFromFile(file);
	  var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
	                              .createInstance(Components.interfaces.nsIFileInputStream);
	  inputStream.init(file, 0x01, 0600, 0);
	  var stream = Components.classes["@mozilla.org/binaryinputstream;1"]
	                         .createInstance(Components.interfaces.nsIBinaryInputStream);
	  stream.setInputStream(inputStream);
	  var encoded = btoa(stream.readBytes(stream.available()));
	  return "data:" + contentType + ";base64," + encoded;
	},
	
	createFinished : function(myProc){
		if(myProc.callback != null)
			myProc.callback.displayThumb(myProc.trgFile,myProc.objArgs);
		
		this.processing=false;
		this.execCreate();
	},
	
}	
	

