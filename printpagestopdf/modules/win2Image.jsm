/*
 * File based on on Screengrab! extension by Andy Mutton
 */
Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
Components.utils.import("resource://printPages2PdfMod/pageDimensions.jsm"); 

var EXPORTED_SYMBOLS = [ "win2Image", ];

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};
Components.utils.import("resource://printPages2PdfMod/persistWin.jsm",printPages2Pdf);


var printPages2Pdf_imgUtils = {
		    
    saveScreenToFile : function(nsFile, dataUrl, format) {    	

		if (!nsFile.exists()) {
			nsFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 420);
		} else {
			return;
		}
		
        if (nsFile != null) {
            var binaryInputStream = printPages2Pdf_imgUtils.dataUrlToBinaryInputStream(dataUrl);
            var fileOutputStream = printPages2Pdf_imgUtils.newFileOutputStream(nsFile);
            printPages2Pdf_imgUtils.writeBinaryInputStreamToFileOutputStream(binaryInputStream, fileOutputStream);
            fileOutputStream.close();
        } 
    },
    
    
    
    dataUrlToBinaryInputStream : function(dataUrl) {
        var nsIoService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
        var channel = nsIoService.newChannelFromURI(nsIoService.newURI(dataUrl, null, null));
        
        var binaryInputStream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
        binaryInputStream.setInputStream(channel.open());
        return binaryInputStream;
    },
    
    newFileOutputStream : function(nsFile) {
        var writeFlag = 0x02;
        var createFlag = 0x08;
        var truncateFlag = 0x20;
        var fileOutputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
        fileOutputStream.init(nsFile, writeFlag | createFlag | truncateFlag,-1, null);
        return fileOutputStream;
    },
    
    writeBinaryInputStreamToFileOutputStream : function(binaryInputStream, fileOutputStream) {
        var numBytes = binaryInputStream.available();
        var bytes = binaryInputStream.readBytes(numBytes);
        
        fileOutputStream.write(bytes, numBytes);
    },
    
    prepareContext : function(canvas, box) {
        var context = canvas.getContext('2d');
        context.clearRect(box.getX(), box.getY(), box.getWidth(), box.getHeight());
        context.save();
        return context;
    },
    
    prepareCanvas : function(width, height,canvas) {
        var styleWidth = width  + 'px';
        var styleHeight = height + 'px';
        
        var grabCanvas =canvas?canvas: document.getElementById('printPages2Pdf_buffer_canvas');
        grabCanvas.width = width;
        grabCanvas.style.width = styleWidth;
        grabCanvas.style.maxWidth = styleWidth;
        grabCanvas.height = height;
        grabCanvas.style.height = styleHeight;
        grabCanvas.style.maxHeight = styleHeight;
    
        return grabCanvas;
    },
    
}


var printPages2Pdf_Dimensions = {

	Box : function(x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	},

	FrameDimensions : function(win) {
		this.frame = win;
		this.doc = this.frame.document;
	},


}

printPages2Pdf_Dimensions.Box.prototype = {

	getX : function() {
		return this.x;
	},

	getY : function() {
		return this.y;
	},

	getWidth : function() {
		return this.width;
	},

	getHeight : function() {
		return this.height;
	}
}




printPages2Pdf_Dimensions.FrameDimensions.prototype = {
	getWindow : function() {
		return this.frame;
	},

	getFrameHeight : function() {
		if (this.doc.compatMode == "CSS1Compat") {
			// standards mode
			return this.doc.documentElement.clientHeight;
		} else {
			// quirks mode
			return this.doc.body.clientHeight;
		}
	},

	getFrameWidth : function() {
		if (this.doc.compatMode == "CSS1Compat") {
			// standards mode
			return this.doc.documentElement.clientWidth;
		} else {
			// quirks mode
			return this.doc.body.clientWidth;
		}
	},

	getDocumentHeight : function() {
		return this.doc.documentElement.scrollHeight;
	},

	getDocumentWidth : function() {
		if (this.doc.compatMode == "CSS1Compat") {
			// standards mode
			return this.doc.documentElement.scrollWidth;
		} else {
			// quirks mode
			return this.doc.body.scrollWidth;
		}
	},

	getScreenX : function() {
		var offsetFromOrigin = 0;
		if (this.frame.frameElement) {
			offsetFromOrigin = this.frame.frameElement.offsetLeft;
		}
		return this.viewport.getScreenX() + offsetFromOrigin;
	},

	getScreenY : function() {
		var offsetFromOrigin = 0;
		if (this.frame.frameElement) {
			offsetFromOrigin = this.frame.frameElement.offsetTop;
		}
		return this.viewport.getScreenY() + offsetFromOrigin;
	}
}



var win2Image = {
	_canvas:null,

	saveCompleteWindow:function(workDir,win,canvas,title){
		var format = 'png';
		this._canvas=canvas;
		var targetFile = workDir.clone();
		targetFile.append("data");
		targetFile.createUnique(targetFile.DIRECTORY_TYPE,0755);
		var targetDir=targetFile.clone();
		targetFile.append("index.png");		
		//this.grabCompletePage(win,targetFile);
		
		if (win.document.documentElement) {
//			win.document.body.style.width=(pageDimensions.width ) + "mm";
			win.document.documentElement.style.minWidth=(pageDimensions.width + (pageDimensions.width / 4)) + "mm";
		}
		
	  var canvasWidth = win.scrollMaxX + win.innerWidth;
	  var canvasHeight = win.scrollMaxY + win.innerHeight;

  /*
     Remove offset from scrollbar width.

     17px on WindowsXP, but this may depends on client theme or something.
     I guess the real width would be 16, plus extra 1px border for drop-
     -shadow.
     XXX FIX ME!
   */
  if (win.scrollMaxX)
    canvasHeight -= 17;

  if (win.scrollMaxY)
    canvasWidth -= 17;

  this._canvas.style.width = canvasWidth + "px";
  this._canvas.style.height = canvasHeight + "px";
  this._canvas.width = canvasWidth;
  this._canvas.height = canvasHeight;


  var ctx = this._canvas.getContext("2d");
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.scale(1, 1);
  ctx.drawWindow(win, 0, 0, canvasWidth, canvasHeight,
                 "rgb(128,128,128)");
  ctx.restore();
//  document.documentElement.appendChild(canvas);
	var dataUrl = this._canvas.toDataURL('image/' + format);

	printPages2Pdf_imgUtils.saveScreenToFile(targetFile,dataUrl, format);

	
		
		
		targetDir.append("index.html");
		this.writeDOMFile(win.document,targetDir,title);
		
		var fileUrl=printPages2Pdf.saver.CommonUtils.convertFilePathToURL(targetDir.path);
		return fileUrl;
		
	},


	
	writeDOMFile:function(document,file,title){
		var dt = document.implementation.createDocumentType('html', '-//W3C//DTD HTML 4.01//EN', 'http://www.w3.org/TR/html4/strict.dtd');  
		var doc = document.implementation.createDocument ("", "", dt);  
		
		var html=doc.createElement("html");
		var head=doc.createElement("head");
		var ndTitle=doc.createElement("title");
		ndTitle.textContent=title;
		var body=doc.createElement("body");
		var image=doc.createElement("image");
		image.setAttribute("src","index.png");
		image.setAttribute("style","display:block;position:absolute;top:0px;left:0px;z-index:0;");
		
		var h1=doc.createElement("H1");
		h1.textContent=title;
		h1.setAttribute("style","display:block;position:absolute;top:0px;left:0px;z-index:-9999;font-size:1px;color:transparent;");
		var dummy=doc.createTextNode("d");
		
		head.appendChild(ndTitle);
		body.appendChild(h1);
		body.appendChild(dummy);
		body.appendChild(image);
		html.appendChild(head);
		html.appendChild(body);
		doc.appendChild(html);
		
		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].  
		           createInstance(Components.interfaces.nsIFileOutputStream);  
		
		foStream.init(file, 0x02 | 0x08 | 0x20, -1, 0);   
		// write, create, truncate  
		
		var s = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer);   
		
		s.serializeToStream(doc,foStream,"UTF-8");  
		foStream.close();

		
	},
	


}
