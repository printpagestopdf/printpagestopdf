Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
Components.utils.import("resource://printPages2PdfMod/pageDimensions.jsm"); 

var EXPORTED_SYMBOLS = [ "saver", ];


var saver={};

saver.CommonUtils = {


	get UNICODE() { return Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter); },
	get IO()      { return Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); },




	getFileName : function(aURI)
	{
		var pos, name;
		name = ( (pos = aURI.indexOf("?")) != -1 ) ? aURI.substring(0, pos) : aURI;
		name = ( (pos = name.indexOf("#")) != -1 ) ? name.substring(0, pos) : name;
		name = ( (pos = name.lastIndexOf("/")) != -1 ) ? name.substring(++pos) : name;
		return name;
	},

	splitFileName : function(aFileName)
	{
		var pos = aFileName.lastIndexOf(".");
		var ret = [];
		if ( pos != -1 ) {
			ret[0] = aFileName.substring(0, pos);
			ret[1] = aFileName.substring(pos + 1, aFileName.length);
		} else {
			ret[0] = aFileName;
			ret[1] = "";
		}
		return ret;
	},

	validateFileName : function(aFileName)
	{
		aFileName = aFileName.replace(/[\"\?!~`]+/g, "");
		aFileName = aFileName.replace(/[\*\&]+/g, "+");
		aFileName = aFileName.replace(/[\\\/\|\:;]+/g, "-");
		aFileName = aFileName.replace(/[\<]+/g, "(");
		aFileName = aFileName.replace(/[\>]+/g, ")");
		aFileName = aFileName.replace(/[\s]+/g, "_");
		aFileName = aFileName.replace(/[%]+/g, "@");
		return aFileName;
	},

	resolveURL : function(aBaseURL, aRelURL)
	{
		try {
			var baseURLObj = this.convertURLToObject(aBaseURL);
			//" entfernen aus aRelURL
			aRelURL = aRelURL.replace(/\"/g, "");
			return baseURLObj.resolve(aRelURL);
		} catch(ex) {
			//dump("*** printPages2Pdf ERROR: Failed to resolve URL: " + aBaseURL + "\t" + aRelURL + "\n");
		}
	},



	writeFile : function(aFile, aContent, aChars)
	{
		if ( aFile.exists() ) aFile.remove(false);
		try {
			aFile.create(aFile.NORMAL_FILE_TYPE,0666);
			this.UNICODE.charset = aChars;
			aContent = this.UNICODE.ConvertFromUnicode(aContent);
			var ostream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
			ostream.init(aFile, 2, 0x600, false);
			ostream.write(aContent, aContent.length);
			ostream.close();
		}
		catch(ex)
		{
			alert("printPages2Pdf: Failed to write file: " + aFile.leafName);
		}
	},


	convertURLToObject : function(aURLString)
	{
		var aURL = Components.classes['@mozilla.org/network/standard-url;1'].createInstance(Components.interfaces.nsIURI);
		aURL.spec = aURLString;
		return aURL;
	},

	convertFilePathToURL : function(aFilePath)
	{
		var tmpFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
		tmpFile.initWithPath(aFilePath);
		return this.IO.newFileURI(tmpFile).spec;
	},


	convertURLToFile : function(aURLString)
	{
		var aURL = this.convertURLToObject(aURLString);
		if ( !aURL.schemeIs("file") ) return;
		try {
			var fileHandler = this.IO.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
			return fileHandler.getFileFromURLSpec(aURLString);
		} catch(ex) {
		}
	},



};



saver.ContentSaver = {

	actualCallback:null,
	name         : "",
	item         : null,
	contentDir   : null,
	httpTask     : {},
	numHttpTasks : {},
	file2URL     : {},
	option       : {},
	plusoption   : {},
	refURLObj    : null,
	favicon      : null,
	frameList    : [],
	frameNumber  : 0,
	selection    : null,
	linkURLs     : [],
	_fxVer3      : null,
	_fxVer35     : null,
	_WBPersists	 : [],
	_rootWin	 : null,



	flattenFrames : function(aWindow)
	{
		var ret = [aWindow];

		for ( var i = 0; i < aWindow.frames.length; i++ )
		{
			ret = ret.concat(this.flattenFrames(aWindow.frames[i]));
		}

		return ret;
	},

	init : function(aPresetData)
	{
		if ( this._fxVer3 == null )
		{
			var iAppInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
			var iVerComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
			this._fxVer3 = iVerComparator.compare(iAppInfo.version, "3.0")>=0;
			this._fxVer35 = iVerComparator.compare(iAppInfo.version, "3.5")>=0;
		}
		this.item = { id : "12345678901234", type : "", title : "", chars : "", icon : "", source : "", comment : "" };;
		this.name = "index";
		this.favicon = null;
		this.file2URL = { "index.html" : true, "index.css" : true, "index.dat" : true, "index.png" : true, "sitemap.xml" : true, "sb-file2url.txt" : true, "sb-url2name.txt" : true, };
		this.option   = { "dlimg" : true, "dlsnd" : false, "dlmov" : false, "dlarc" : false, "custom" : "", "inDepth" : 0, "isPartial" : false, "images" : true, "styles" : true, "script" : true };
		this.plusoption = { "method" : "SB", "timeout" : "0", "charset" : "UTF-8" }
		this.linkURLs = [];
		this.frameList = [];
		this.frameNumber = 0;
		this.httpTask[this.item.id] = 0;
		this.numHttpTasks[this.item.id] = 0;
		
	},
	
	
	resetPersist:function(){

		this.httpTask[this.item.id]=0;
		this.numHttpTasks[this.item.id]=0;
		
		for(var i=0;i < this._WBPersists.length;i++){
			try {
				this._WBPersists[i].cancelSave();
			}catch(ex){}	
		}
		
		this._WBPersists.splice(0,this._WBPersists.length);
	},
	
	_maxWaitIntervall:5000,
	_hIntervall:null,
	_isTimerProcessing:false,
	
	resetWaitTimeout: function()
	{
		if(this._isTimerProcessing == true) return;
		this._isTimerProcessing=true;
		
		if(this._hIntervall)
			this._rootWin.clearTimeout(this._hIntervall);
		
		var me=this;	
		this._hIntervall=this._rootWin.setTimeout(function(){me.onWaitTimeout();},this._maxWaitIntervall);
		
		this._isTimerProcessing=false;
	},
	
	onWaitTimeout:function(){
		this.actualCallback.onCaptureComplete(saver.ContentSaver.item,this);
		
		this.status=RRprintPages2Pdf.TIMEOUT;
	},
	
	//from some reason the lib ignores frames that have variable sizes. this should fix it	
	fixFrames:function(win){
		var retVal=false;
		if(!win) return retVal;
		
		var frames=win.document.getElementsByTagName( "iframe" );
		for ( var i = 0; i < frames.length; i++ )
		{
			var frame=frames[i];
			var cstyle=win.getComputedStyle(frame,null);
			
			frame.setUserData("orgHeight",cstyle.getPropertyValue('height'),null);
			frame.style.height=cstyle.height;
			
			retVal=true;
		}
		
		return retVal;

	},

	unfixFrames:function(win){
		if(!win) return;
		
		
		var frames=win.document.getElementsByTagName( "iframe" );
		for ( var i = 0; i < frames.length; i++ )
		{
			var frame=frames[i];
			
			if (frame.getUserData("orgHeight") != null) {
				frame.style.height = frame.getUserData("orgHeight");
			}
		}
	},
	
	saveOuterHtml: function(workDir,aRootWindow,bReturnUrl)
	{
		
		
		var trgFile = workDir.clone();

		trgFile.append("data");
		trgFile.createUnique(trgFile.DIRECTORY_TYPE,0777);
		trgFile.append("off_content.html")



		var frmFixed=false;		

		try {
			frmFixed=this.fixFrames(aRootWindow);
		}catch(e){}

		var doc = aRootWindow.document.implementation.createHTMLDocument('');
		var ndNew=doc.importNode(aRootWindow.document.documentElement,true);
		doc.documentElement.parentNode.replaceChild(ndNew,doc.documentElement);
		//		var doc = (new DOMParser()).parseFromString("", "text/html");
/*
doc.open();
doc.write(aRootWindow.document.documentElement.outerHTML);
doc.close();*/
//		saver.CommonUtils.writeFile(trgFile, aRootWindow.document.documentElement.outerHTML, "UTF-8");
		saver.CommonUtils.writeFile(trgFile, doc.documentElement.outerHTML, "UTF-8");

		if(frmFixed)
			this.unfixFrames(aRootWindow);
			
		if(aRootWindow.document.cookie)
		{
			var cookieFile = workDir.clone();
			cookieFile.append("pp2pdfCookie.txt");
			var cookies=aRootWindow.document.cookie.split(";");
			
			var now=new Date();
			now.setFullYear(now.getFullYear() + 1);
			for(var i=0;i < cookies.length;i++)
			{
				cookies[i] += "; expires=" + now.toGMTString() + "; domain=" + aRootWindow.location.hostname + "; path=/";
			}

			
			saver.CommonUtils.writeFile(cookieFile, cookies.join("\r\n"), "UTF-8");			
		}

		if(bReturnUrl)
			return saver.CommonUtils.IO.newFileURI(trgFile).spec;
		else
			return trgFile.path;
		
	},
	
	captureWindowSync: function(workDir,aRootWindow)
	{

		var frmFixed=false;		

		try {
			frmFixed=this.fixFrames(aRootWindow);
		}catch(e){
		}

		
		var fileUrl=this.captureWindow(workDir,aRootWindow, false, false, "999999999", 0, null);
		
		 var thread = Components.classes["@mozilla.org/thread-manager;1"]
                        .getService(Components.interfaces.nsIThreadManager)
                        .currentThread;

		RRprintPages2Pdf.persistLoops++;
		try {
			while (RRprintPages2Pdf.isStatus(this.status, RRprintPages2Pdf.RUNNING) && !RRprintPages2Pdf.stopPersist) {
				thread.processNextEvent(true);
			}
		} 
		catch (e) {
		}
		finally {
			if(frmFixed)
				this.unfixFrames(aRootWindow);
			this.cleanRefs();
		}
		RRprintPages2Pdf.persistLoops--;
		this.resetPersist();
		if (RRprintPages2Pdf.stopPersist == true) throw new RRprintPages2Pdf.Exception("persistWin","cancel","Operation cancelled");
		if(RRprintPages2Pdf.isStatus(this.status,RRprintPages2Pdf.ERROR)) throw new RRprintPages2Pdf.Exception("persistWin","persisterror","Save Error");
		
		return fileUrl;

	},
	
	cleanRefs:function(){
			this._rootWin = null;
			for(var f in this.frameList){
				this.frameList[f]=null;
			}
	},
		
	captureWindow : function(workDir,aRootWindow, aIsPartial, aShowDetail, aResName, aResIndex, aPresetData, aContext, aTitle)
	{
		

		this.status=RRprintPages2Pdf.RUNNING; 
		this._rootWin=aRootWindow;

		this.init(aPresetData);
		
		/*
		if(RRprintPages2Pdf.prefs.getCharPref("wkhtml.oopt.web.enableJavascript") === "true")
			this.option["script"]=true;
		else
			this.option["script"]=false;
		*/
		this.option["script"]=false;
		
		
		this.item.chars  = aRootWindow.document.characterSet;
		this.item.source = aRootWindow.location.href;

		this.frameList = this.flattenFrames(aRootWindow);
		var titles = aRootWindow.document.title ? [aRootWindow.document.title] : [this.item.source];
		if ( aTitle ) titles[0] = aTitle;
		this.selection = null;
		this.item.title = titles[0];

		this.contentDir = workDir.clone();
		this.contentDir.append("data");
		this.contentDir.createUnique(this.contentDir.DIRECTORY_TYPE,0777);
		this.actualCallback.onPageDownloadStart(this.item,this);		
//		saver.CaptureObserverCallback.onPageDownloadStart(this.item,this);		
		
		
		this.saveDocumentInternal(aRootWindow.document, this.name);
		if ( this.item.icon && this.item.type != "image" && this.item.type != "file" )
		{
			var iconFileName = this.download(this.item.icon);
			this.favicon = iconFileName;
		}
		if ( this.httpTask[this.item.id] == 0 )
		{
//			setTimeout(function(){ saver.CaptureObserverCallback.onCaptureComplete(saver.ContentSaver.item,this); }, 100);
//			saver.CaptureObserverCallback.onCaptureComplete(saver.ContentSaver.item,this);
			
			this.actualCallback.onCaptureComplete(saver.ContentSaver.item,this);
			this.status=RRprintPages2Pdf.SUCCESS;

		}
/*
		if ( this.option["inDepth"] > 0 && this.linkURLs.length > 0 )
		{
			if ( !aPresetData || aContext == "capture-again" )
			{
				this.item.type = "marked";
				this.option["isPartial"] = aIsPartial;
				window.openDialog(
					"chrome://scrapbook/content/capture.xul", "", "chrome,centerscreen,all,dialog=no",
					this.linkURLs, this.refURLObj.spec,
					false, null, 0,
					this.item, this.option, this.file2URL, null, this.plusoption["method"], this.plusoption["charset"], this.plusoption["timeout"]
				);
			}
			else
			{
				for ( var i = 0; i < this.linkURLs.length; i++ )
				{
					sbCaptureTask.add(this.linkURLs[i], aPresetData[4] + 1);
				}
			}
		}


		return [this.name, this.file2URL];
*/
		var targetFile=this.contentDir.clone();
		targetFile.append(this.name + ".html");
		return saver.CommonUtils.convertFilePathToURL(targetFile.path);
	},



	saveDocumentInternal : function(aDocument, aFileKey)
	{
		if ( !aDocument.body || !aDocument.contentType.match(/html|xml/i) )
		{
			var captureType = (aDocument.contentType.substring(0,5) == "image") ? "image" : "file";
			if ( this.frameNumber == 0 ) this.item.type = captureType;
			var newLeafName = this.saveFileInternal(aDocument.location.href, aFileKey, captureType);
			return newLeafName;
		}
		this.refURLObj = saver.CommonUtils.convertURLToObject(aDocument.location.href);

		if ( this.selection )
		{
			var myRange = this.selection.getRangeAt(0);
			var myDocFrag = myRange.cloneContents();
			var curNode = myRange.commonAncestorContainer;
			if ( curNode.nodeName == "#text" ) curNode = curNode.parentNode;
		}
		var tmpNodeList = [];
		if ( this.selection )
		{
			do {
				tmpNodeList.unshift(curNode.cloneNode(false));
				curNode = curNode.parentNode;
			}
			while ( curNode.nodeName.toUpperCase() != "HTML" );
		}
		else
		{
			tmpNodeList.unshift(aDocument.body.cloneNode(true));
		}
		var rootNode = aDocument.getElementsByTagName("html")[0].cloneNode(false);
		try {
			var headNode = aDocument.getElementsByTagName("head")[0].cloneNode(true);
			rootNode.appendChild(headNode);
			rootNode.appendChild(aDocument.createTextNode("\n"));
		} catch(ex) {
		}
		rootNode.appendChild(tmpNodeList[0]);
		rootNode.appendChild(aDocument.createTextNode("\n"));
		for ( var n = 0; n < tmpNodeList.length-1; n++ )
		{
			tmpNodeList[n].appendChild(aDocument.createTextNode("\n"));
			tmpNodeList[n].appendChild(tmpNodeList[n+1]);
			tmpNodeList[n].appendChild(aDocument.createTextNode("\n"));
		}



//		var rootNode = aDocument.getElementsByTagName("html")[0].cloneNode(true);
//		var rootNode = aDocument.documentElement.cloneNode(true);
		
		//going around the textarea clone value (bug?)
		var srcAreas=aDocument.getElementsByTagName("textarea");
		var trgAreas=rootNode.getElementsByTagName("textarea");
		
		for (var i = 0; i < trgAreas.length; i++) {
			try {
				if (trgAreas[i].id) 
					trgAreas[i].value = aDocument.getElementById(trgAreas[i].id).value;
				else 
					trgAreas[i].value = srcAreas[i].value;
			}catch(e){}
		}
		
		
		this.processDOMRecursively(rootNode);


		var myCSS = "";
		var myCSSprint = "";
		if ( this.option["styles"] )
		{
			var myStyleSheets = aDocument.styleSheets;
			for ( var i=0; i<myStyleSheets.length; i++ )
			{
				myCSS += this.processCSSRecursively(myStyleSheets[i], aDocument);
			}
			if ( myCSS )
			{
				var newLinkNode = aDocument.createElement("link");
				newLinkNode.setAttribute("media", "all");
				newLinkNode.setAttribute("href", aFileKey + ".css");
				newLinkNode.setAttribute("type", "text/css");
				newLinkNode.setAttribute("rel", "stylesheet");
				rootNode.firstChild.appendChild(aDocument.createTextNode("\n"));
				rootNode.firstChild.appendChild(newLinkNode);
				rootNode.firstChild.appendChild(aDocument.createTextNode("\n"));
				myCSS = myCSS.replace(/\*\|/g, "");
			}
			
			//Bug wkhtmltopdf with letterspacing
			myCSS += "\r\n* {letter-spacing: normal !important; " + 
					"text-rendering: optimizeSpeed; }\r\n";


			for ( var i=0; i<myStyleSheets.length; i++ )
			{
				myCSSprint += this.processCSSprintRecursively(myStyleSheets[i], aDocument);
			}
			if ( myCSSprint )
			{
				var newLinkNode = aDocument.createElement("link");
				newLinkNode.setAttribute("media", "print");
				newLinkNode.setAttribute("href", aFileKey + "_print.css");
				newLinkNode.setAttribute("type", "text/css");
				newLinkNode.setAttribute("rel", "stylesheet");
				rootNode.firstChild.appendChild(aDocument.createTextNode("\n"));
				rootNode.firstChild.appendChild(newLinkNode);
				rootNode.firstChild.appendChild(aDocument.createTextNode("\n"));
				myCSSprint = myCSSprint.replace(/\*\|/g, "");
			}
			//Bug wkhtmltopdf with letterspacing
			myCSSprint += "\r\n* {letter-spacing: normal !important; " + 
					"text-rendering: optimizeSpeed; }\r\n";

		}


		this.item.chars = "UTF-8";
		var metaNode = aDocument.createElement("meta");
		metaNode.setAttribute("content", aDocument.contentType + "; charset=" + this.item.chars);
		metaNode.setAttribute("http-equiv", "Content-Type");
		rootNode.firstChild.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild.firstChild);
		rootNode.firstChild.insertBefore(metaNode, rootNode.firstChild.firstChild);
		rootNode.firstChild.insertBefore(aDocument.createTextNode("\n"), rootNode.firstChild.firstChild);


		var myHTML;
		myHTML = this.surroundByTags(rootNode, rootNode.innerHTML);
		myHTML = this.doctypeToString(aDocument.doctype) + myHTML;
		myHTML = myHTML.replace(/\x00/g, " ");
		var myHTMLFile = this.contentDir.clone();
		myHTMLFile.append(aFileKey + ".html");
		saver.CommonUtils.writeFile(myHTMLFile, myHTML, this.item.chars);
		
		if ( myCSS )
		{
			var myCSSFile = this.contentDir.clone();
			myCSSFile.append(aFileKey + ".css");
			saver.CommonUtils.writeFile(myCSSFile, myCSS, this.item.chars);
		}

		
		if ( myCSSprint )
		{
			var myCSSFile = this.contentDir.clone();
			myCSSFile.append(aFileKey + "_print.css");
			saver.CommonUtils.writeFile(myCSSFile, myCSSprint, this.item.chars);
		}

		
		return myHTMLFile.leafName;
	},

	saveFileInternal : function(aFileURL, aFileKey, aCaptureType)
	{
		if ( !aFileKey ) aFileKey = "file" + Math.random().toString();
		if ( !this.refURLObj ) this.refURLObj = saver.CommonUtils.convertURLToObject(aFileURL);
		if ( this.frameNumber == 0 )
		{
			this.item.icon  = "moz-icon://" + saver.CommonUtils.getFileName(aFileURL) + "?size=16";
			this.item.type  = aCaptureType;
			this.item.chars = "";
		}
		var newFileName = this.download(aFileURL);
		if ( aCaptureType == "image" ) {
			var myHTML = '<html><body><img src="' + newFileName + '"></body></html>';
		} else {
			var myHTML = '<html><head><meta http-equiv="refresh" content="0;URL=./' + newFileName + '"></head><body></body></html>';
		}
		var myHTMLFile = this.contentDir.clone();
		myHTMLFile.append(aFileKey + ".html");
		saver.CommonUtils.writeFile(myHTMLFile, myHTML, "UTF-8");
		return myHTMLFile.leafName;
	},



	surroundByTags : function(aNode, aContent)
	{
		var tag = "<" + aNode.nodeName.toLowerCase();
		for ( var i=0; i<aNode.attributes.length; i++ )
		{
			tag += ' ' + aNode.attributes[i].name + '="' + aNode.attributes[i].value + '"';
		}
		tag += ">\n";
		return tag + aContent + "</" + aNode.nodeName.toLowerCase() + ">\n";
	},


	removeNodeFromParent : function(aNode)
	{
		var newNode = aNode.ownerDocument.createTextNode("");
		aNode.parentNode.replaceChild(newNode, aNode);
		aNode = newNode;
		return aNode;
	},

	doctypeToString : function(aDoctype)
	{
		if ( !aDoctype ) return "";
		var ret = "<!DOCTYPE " + aDoctype.name;
		if ( aDoctype.publicId ) ret += ' PUBLIC "' + aDoctype.publicId + '"';
		if ( aDoctype.systemId ) ret += ' "'        + aDoctype.systemId + '"';
		ret += ">\n";
		return ret;
	},


	processDOMRecursively : function(rootNode)
	{
		for ( var curNode = rootNode.firstChild; curNode != null; curNode = curNode.nextSibling )
		{
			if ( curNode.nodeName == "#text" || curNode.nodeName == "#comment" ) continue;
			curNode = this.inspectNode(curNode);
			this.processDOMRecursively(curNode);
		}
	},

	inspectNode : function(aNode)
	{
		switch ( aNode.nodeName.toLowerCase() )
		{
			case "img" : 
			case "embed" : 
				if ( this.option["images"] ) {
					if ( aNode.hasAttribute("onclick") ) aNode = this.normalizeJSLink(aNode, "onclick");
					var aFileName = this.download(aNode.src);
					if (aFileName) aNode.setAttribute("src", aFileName);
					aNode.removeAttribute("livesrc");
				} else {
					return this.removeNodeFromParent(aNode);
				}
				break;
			case "object" : 
				if ( this.option["images"] ) {
					var aFileName = this.download(aNode.data);
					if (aFileName) aNode.setAttribute("data", aFileName);
				} else {
					return this.removeNodeFromParent(aNode);
				}
				break;
			case "body" : 
				if ( this.option["images"] ) {
					var aFileName = this.download(aNode.background);
					if (aFileName) aNode.setAttribute("background", aFileName);
				} else {
					aNode.removeAttribute("background");
					aNode.removeAttribute("bgcolor");
					aNode.removeAttribute("text");
				}
				break;
			case "table" : 
			case "tr" : 
			case "th" : 
			case "td" : 
				if ( this.option["images"] ) {
					var aFileName = this.download(aNode.getAttribute("background"));
					if (aFileName) aNode.setAttribute("background", aFileName);
				} else {
					aNode.removeAttribute("background");
					aNode.removeAttribute("bgcolor");
				}
				break;

			case "textarea":
				if(aNode.value)
					aNode.textContent=aNode.value;
				break;

			case "input" : 
				switch (aNode.type.toLowerCase()) {
					case "image": 
						if (this.option["images"]) {
							var aFileName = this.download(aNode.src);
							if (aFileName) aNode.setAttribute("src", aFileName);
						}
						else {
							aNode.removeAttribute("src");
							aNode.setAttribute("type", "button");
							if (aNode.hasAttribute("alt"))
								aNode.setAttribute("value", aNode.getAttribute("alt"));
						}
						break;
					case "text": 
						aNode.setAttribute("value", aNode.value);
						break;
					case "checkbox": 
					case "radio": 
						if (aNode.checked)
							aNode.setAttribute("checked", "checked");
						else
							aNode.removeAttribute("checked");
						break;
					default:
				}
				break;
			case "link" : 
				if ( aNode.rel.toLowerCase() == "stylesheet" && (aNode.href.indexOf("chrome") != 0 || !this.option["styles"]) ) {
					return this.removeNodeFromParent(aNode);
				} else if ( aNode.rel.toLowerCase() == "shortcut icon" || aNode.rel.toLowerCase() == "icon" ) {
					var aFileName = this.download(aNode.href);
					if (aFileName) aNode.setAttribute("href", aFileName);
					if ( this.frameNumber == 0 && !this.favicon ) this.favicon = aFileName;
				} else {
					aNode.setAttribute("href", aNode.href);
				}
				break;
			case "base" : 
				aNode.removeAttribute("href");
				if ( !aNode.hasAttribute("target") ) return this.removeNodeFromParent(aNode);
				break;
			case "style" : 
				return this.removeNodeFromParent(aNode);
				break;
			case "script" : 
			case "noscript" : 
				if ( this.option["script"] ) {
					if ( aNode.hasAttribute("src") ) {
						var aFileName = this.download(aNode.src);
						if (aFileName) aNode.setAttribute("src", aFileName);
						
					}
				} else {
					return this.removeNodeFromParent(aNode);
				}
				break;
			case "a" : 
			case "area" : 
				if ( aNode.hasAttribute("onclick") ) aNode = this.normalizeJSLink(aNode, "onclick");
				if ( !aNode.hasAttribute("href") ) return aNode;
				if ( aNode.target == "_blank" ) aNode.setAttribute("target", "_top");
				if ( aNode.href.match(/^javascript:/i) ) aNode = this.normalizeJSLink(aNode, "href");
				if ( !this.selection && aNode.getAttribute("href").charAt(0) == "#" ) return aNode;
				var ext = saver.CommonUtils.splitFileName(saver.CommonUtils.getFileName(aNode.href))[1].toLowerCase();
				var dateiname = saver.CommonUtils.splitFileName(saver.CommonUtils.getFileName(aNode.href))[0].toLowerCase();
				if (dateiname.search(":") >= 0)	ext = ext.toLowerCase();
				var flag = false;
				switch ( ext )
				{
					case "jpg" : case "jpeg" : case "png" : case "gif" : case "tiff" : flag = this.option["dlimg"]; break;
					case "mp3" : case "wav"  : case "ram" : case "rm"  : case "wma"  : flag = this.option["dlsnd"]; break;
					case "mpg" : case "mpeg" : case "avi" : case "mov" : case "wmv"  : flag = this.option["dlmov"]; break;
					case "zip" : case "lzh"  : case "rar" : case "jar" : case "xpi"  : flag = this.option["dlarc"]; break;
					default : if ( this.option["inDepth"] > 0 ) this.linkURLs.push(aNode.href);
				}
				if ( !flag && ext && this.option["custom"] )
				{
					if ( (", " + this.option["custom"] + ", ").indexOf(", " + ext + ", ") != -1 ) flag = true;
				}
				if ( aNode.href.indexOf("file://") == 0 && !aNode.href.match(/\.html(?:#.*)?$/) ) flag = true;
				if ( flag ) {
					var aFileName = this.download(aNode.href);
					if (aFileName) aNode.setAttribute("href", aFileName);
				} else {
					aNode.setAttribute("href", aNode.href);
				}
				break;
			case "form" : 
				aNode.setAttribute("action", saver.CommonUtils.resolveURL(this.refURLObj.spec, aNode.action));
				break;
			case "meta" : 
				if ( aNode.hasAttribute("http-equiv") && aNode.hasAttribute("content") &&
				     aNode.getAttribute("http-equiv").toLowerCase() == "content-type" && 
				     aNode.getAttribute("content").match(/charset\=/i) )
				{
					return this.removeNodeFromParent(aNode);
				}
				break;
			case "frame"  : 
			case "iframe" : 
				if ( this.selection ) {
					this.selection = null;
					for ( var fn = this.frameNumber; fn < this.frameList.length; fn++ )
					{
						if ( aNode.src == this.frameList[fn].location.href ) { this.frameNumber = fn; break; }
					}
					this.frameNumber--;
				}
				var tmpRefURL = this.refURLObj;
				this.frameNumber++
				try {
					var newFileName = this.saveDocumentInternal(this.frameList[this.frameNumber].document, this.name + "_" + this.frameNumber);
					aNode.setAttribute("src", newFileName);
				} catch(ex) {
				}
				this.refURLObj = tmpRefURL;
				break;
			case "xmp" : 
				if ( aNode.firstChild )
				{
					var pre = aNode.ownerDocument.createElement("pre");
					pre.appendChild(aNode.firstChild);
					aNode.parentNode.replaceChild(pre, aNode);
				}
				break;
		}
		if ( !this.option["styles"] )
		{
			aNode.removeAttribute("style");
		}
		else if ( aNode.style && aNode.style.cssText )
		{
			var newCSStext = this.inspectCSSText(aNode.style.cssText, this.refURLObj.spec, aNode.ownerDocument);
			if ( newCSStext ) aNode.setAttribute("style", newCSStext);
		}
		if ( !this.option["script"] )
		{
			aNode.removeAttribute("onmouseover");
			aNode.removeAttribute("onmouseout");
			aNode.removeAttribute("onload");
		}
		if (aNode.hasAttribute("_base_href")) {
			aNode.removeAttribute("_base_href");
		}
		return aNode;
	},

	processCSSprintRecursively : function(aCSS, aDocument)
	{
		var content = "";
		if (!aCSS || aCSS.disabled) {
			return "";
		}
		var cssMedia = aCSS.media.mediaText;
		if (cssMedia && cssMedia.indexOf("print") < 0 && cssMedia.indexOf("all") < 0) {
			return "";
		}
		if (aCSS.href && aCSS.href.indexOf("chrome://") == 0) {
			return "";
		}
		if (aCSS.href)
			content += (content ? "\n" : "") + "/* ::::: " + aCSS.href + " ::::: */\n\n";
		Array.forEach(aCSS.cssRules, function(cssRule) {
			switch (cssRule.type) {
				case Components.interfaces.nsIDOMCSSRule.STYLE_RULE: 
					var cssText = this.inspectCSSText(cssRule.cssText, aCSS.href, aDocument);
					if (cssText)
						content += cssText + "\n";
					break;
				case Components.interfaces.nsIDOMCSSRule.IMPORT_RULE: 
					content += this.processCSSprintRecursively(cssRule.styleSheet, aDocument);
					break;
				case Components.interfaces.nsIDOMCSSRule.MEDIA_RULE: 
					if (/^@media ([^\{]+) \{/.test(cssRule.cssText)) {
						var media = RegExp.$1;
						if (media.indexOf("screen") < 0 && media.indexOf("all") < 0) {
							break;
						}
					}
					cssRule.cssText.split("\n").forEach(function(cssText) {
						if (cssText.indexOf("@media ") == 0 || cssText == "}") {
							content += cssText + "\n";
						}
						else {
							cssText = cssText.replace(/^\s+|\s+$/g, "");
							cssText = this.inspectCSSText(cssText, aCSS.href, aDocument);
							if (cssText)
								content += "\t" + cssText + "\n";
						}
					}, this);
					break;
				case Components.interfaces.nsIDOMCSSRule.FONT_FACE_RULE: 
					cssRule.cssText.split("\n").forEach(function(cssText) {
						if (cssText == "@font-face {" || cssText == "}") {
							content += cssText + "\n";
						}
						else {
							cssText = cssText.replace(/^\s+|\s+$/g, "");
							cssText = this.inspectCSSText(cssText, aCSS.href, aDocument);
							if (cssText)
								content += "\t" + cssText + "\n";
						}
					}, this);
					break;
				default: 
			}
		}, this);
		return content;

	},


	processCSSRecursively : function(aCSS, aDocument)
	{
		var content = "";
		if (!aCSS || aCSS.disabled) {
			return "";
		}
		var cssMedia = aCSS.media.mediaText;
		if (cssMedia && cssMedia.indexOf("screen") < 0 && cssMedia.indexOf("all") < 0) {
			return "";
		}
		if (aCSS.href && aCSS.href.indexOf("chrome://") == 0) {
			return "";
		}
		if (aCSS.href)
			content += (content ? "\n" : "") + "/* ::::: " + aCSS.href + " ::::: */\n\n";
		Array.forEach(aCSS.cssRules, function(cssRule) {
			switch (cssRule.type) {
				case Components.interfaces.nsIDOMCSSRule.STYLE_RULE: 
					var cssText = this.inspectCSSText(cssRule.cssText, aCSS.href, aDocument);
					if (cssText)
						content += cssText + "\n";
					break;
				case Components.interfaces.nsIDOMCSSRule.IMPORT_RULE: 
					content += this.processCSSRecursively(cssRule.styleSheet, aDocument);
					break;
				case Components.interfaces.nsIDOMCSSRule.MEDIA_RULE: 
					if (/^@media ([^\{]+) \{/.test(cssRule.cssText)) {
						var media = RegExp.$1;
						if (media.indexOf("screen") < 0 && media.indexOf("all") < 0) {
							break;
						}
					}
					cssRule.cssText.split("\n").forEach(function(cssText) {
						if (cssText.indexOf("@media ") == 0 || cssText == "}") {
							content += cssText + "\n";
						}
						else {
							cssText = cssText.replace(/^\s+|\s+$/g, "");
							cssText = this.inspectCSSText(cssText, aCSS.href, aDocument);
							if (cssText)
								content += "\t" + cssText + "\n";
						}
					}, this);
					break;
				case Components.interfaces.nsIDOMCSSRule.FONT_FACE_RULE: 
					cssRule.cssText.split("\n").forEach(function(cssText) {
						if (cssText == "@font-face {" || cssText == "}") {
							content += cssText + "\n";
						}
						else {
							cssText = cssText.replace(/^\s+|\s+$/g, "");
							cssText = this.inspectCSSText(cssText, aCSS.href, aDocument);
							if (cssText)
								content += "\t" + cssText + "\n";
						}
					}, this);
					break;
				default: 
			}
		}, this);
		return content;
	},


	inspectCSSText : function(aCSStext, aCSShref, aDocument)
	{
		if ( aCSStext.match(/webchunks/i) )
		{
			//Der Inhalt von Zeilen, die "webchunks" enthalten, muss geloescht werden, um Fehler nach dem Entfernen von Webchunks zu vermeiden
			return "";
		} 
		
		if (!aCSShref) {
			aCSShref = this.refURLObj.spec;
		}
		if ( !aCSStext ) return;
		if (/^([^\{]+)\s+\{/.test(aCSStext)) {
			var selectors = RegExp.$1.trim();
			selectors = selectors.replace(/:[a-z-]+/g, "");
			try {
				if (!aDocument.querySelector(selectors))
					return;
			}
			catch (ex) {}
		}
		var re = new RegExp(/ url\(([^\'\)\s]+)\)/);
		var i = 0;
		while ( aCSStext.match(re) )
		{
			if ( ++i > 10 ) break;
			var imgURL  = RegExp.$1;
			if (/^[\'\"]([^\'\"]+)[\'\"]$/.test(imgURL))
				imgURL = RegExp.$1;
			imgURL  = saver.CommonUtils.resolveURL(aCSShref, imgURL);
			var imgFile = this.option["images"] ? this.download(imgURL) : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAIBTAA7";
			aCSStext = aCSStext.replace(re, " url('" + imgFile + "')");
		}
		aCSStext = aCSStext.replace(/([^\{\}])(\r|\n)/g, "$1\\A");
		re = new RegExp(/ content: \"(.*?)\"; /);
		if ( aCSStext.match(re) )
		{
			var innerQuote = RegExp.$1;
			innerQuote = innerQuote.replace(/\"/g, '\\"');
			innerQuote = innerQuote.replace(/\\\" attr\(([^\)]+)\) \\\"/g, '" attr($1) "');
			aCSStext = aCSStext.replace(re, ' content: "' + innerQuote + '"; ');
		}
		if ( aCSStext.match(/ (quotes|voice-family): \"/) )
		{
			return;
		}
		if ( aCSStext.indexOf(" background: ") >= 0 )
		{
			aCSStext = aCSStext.replace(/ -moz-background-[^:]+: -moz-[^;]+;/g, "");
			aCSStext = aCSStext.replace(/ scroll 0(?:pt|px|%);/g, ";");
		}
		if ( aCSStext.indexOf(" background-position: 0") >= 0 )
		{
			aCSStext = aCSStext.replace(/ background-position: 0(?:pt|px|%);/, " background-position: 0 0;");
		}
		return aCSStext;

	},

	download : function(aURLSpec)
	{
		if ( !aURLSpec ) return;
		if ( aURLSpec.indexOf("://") < 0 )
		{
			aURLSpec = saver.CommonUtils.resolveURL(this.refURLObj.spec, aURLSpec);
		}		
		try {
			var aURL = Components.classes['@mozilla.org/network/standard-url;1'].createInstance(Components.interfaces.nsIURL);
			aURL.spec = aURLSpec;
		} catch(ex) {
			return;
		}
		var newFileName = aURL.fileName.toLowerCase();
		if ( !newFileName ) newFileName = "untitled";
		newFileName = saver.CommonUtils.validateFileName(newFileName);
//		newFileName = RRprintPages2Pdf.validateFileName(newFileName);
		if ( this.file2URL[newFileName] == undefined )
		{
			
		}
		else if ( this.file2URL[newFileName] != aURLSpec )
		{
			var seq = 1;
			var fileLR = saver.CommonUtils.splitFileName(newFileName);
			if ( !fileLR[1] ) fileLR[1] = "dat";
			newFileName = fileLR[0] + "_" + this.leftZeroPad3(seq) + "." + fileLR[1];
			while ( this.file2URL[newFileName] != undefined )
			{
				if ( this.file2URL[newFileName] == aURLSpec )
				{
					return newFileName;
				}
				newFileName = fileLR[0] + "_" + this.leftZeroPad3(++seq) + "." + fileLR[1];
			}
		}
		else
		{
			return newFileName;
		}
		if ( aURL.schemeIs("http") || aURL.schemeIs("https") || aURL.schemeIs("ftp") )
		{
			var targetFile = this.contentDir.clone();
			targetFile.append(newFileName);
//Der Try-Catch-Block wird auch bei einem alert innerhalb des Blocks weitergefuehrt!
			try {
				var WBP = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
				WBP.persistFlags |= WBP.PERSIST_FLAGS_FROM_CACHE;
				WBP.persistFlags |= WBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

				this.httpTask[this.item.id]++;
				this.numHttpTasks[this.item.id]++;
				
				WBP.progressListener = new saver.CaptureObserver(this.item, newFileName,this,this.actualCallback);
				
				this._WBPersists.push(WBP);
			
							   
				if (RRprintPages2Pdf.versionChecker.compare(RRprintPages2Pdf.xulAppInfo.version, "18.0") >= 0) {
				
					var privacyContext = this._rootWin.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIWebNavigation).QueryInterface(Components.interfaces.nsILoadContext);					
					WBP.saveURI(aURL, null, this.refURLObj, null, null, targetFile, privacyContext);
				}
				else
					WBP.saveURI(aURL, null, this.refURLObj, null, null, targetFile);
					
				this.file2URL[newFileName] = aURLSpec;

				return newFileName;
			}
			catch(ex) {
				
				//dump("*** printPages2Pdf_PERSIST_FAILURE: " + aURLSpec + "\n" + ex + "\n");
				this.httpTask[this.item.id]--;
				return "";
			}
		}
		else if ( aURL.schemeIs("file") )
		{
			var targetDir = this.contentDir.clone();
			try {
				var orgFile = saver.CommonUtils.convertURLToFile(aURLSpec);
				if ( !orgFile.isFile() ) return;
				orgFile.copyTo(targetDir, newFileName);
				this.file2URL[newFileName] = aURLSpec;
				return newFileName;
			}
			catch(ex) {
				//dump("*** printPages2Pdf_COPY_FAILURE: " + aURLSpec + "\n" + ex + "\n");
				return "";
			}
		}
	},

	leftZeroPad3 : function(num)
	{
		if ( num < 10 ) { return "00" + num; } else if ( num < 100 ) { return "0" + num; } else { return num; }
	},

	normalizeJSLink : function(aNode, aAttr)
	{
		var val = aNode.getAttribute(aAttr);
		if ( !val.match(/\(\'([^\']+)\'/) ) return aNode;
		val = RegExp.$1;
		if ( val.indexOf("/") == -1 && val.indexOf(".") == -1 ) return aNode;
		val = saver.CommonUtils.resolveURL(this.refURLObj.spec, val);
		if ( aNode.nodeName.toLowerCase() == "img" )
		{
			if ( aNode.parentNode.nodeName.toLowerCase() == "a" ) {
				aNode.parentNode.setAttribute("href", val);
				aNode.removeAttribute("onclick");
			} else {
				val = "window.open('" + val + "');";
				aNode.setAttribute(aAttr, val);
			}
		}
		else
		{
			if ( aNode.hasAttribute("href") && aNode.getAttribute("href").indexOf("http://") != 0 )
			{
				aNode.setAttribute("href", val);
				aNode.removeAttribute("onclick");
			}
		}
		return aNode;
	},

};



saver.CaptureObserver = function(aSBitem, aFileName,saver,cb)
{
	this.item     = aSBitem;
	this.fileName = aFileName;
	this.callback = cb;
//	this.callback = printPages2Pdf.saver.CaptureObserverCallback;
	this.saver = saver;
	this.numItems = this.saver.httpTask[this.item.id];
	
}

saver.CaptureObserver.prototype = {

	onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
	{
		saver.resetWaitTimeout;
		if ( aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP )
		{
			if ( --saver.ContentSaver.httpTask[this.item.id] == 0 ) {
				this.callback.onAllDownloadsComplete(this.item,this.saver);
				this.saver.status=RRprintPages2Pdf.SUCCESS;
			} else {
				this.callback.onDownloadComplete(this.item,this.saver,this.numItems,this.saver.httpTask[this.item.id]);
			}
		}
		
	},
	onProgressChange : function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
	{
		saver.resetWaitTimeout;
		//if ( aCurTotalProgress == aMaxTotalProgress ) return;
		var progress = (aMaxSelfProgress > 0) ? Math.round(aCurSelfProgress / aMaxSelfProgress * 100) + "%" : aCurSelfProgress + "Bytes";
		this.callback.onDownloadProgress(this.item, this.fileName, progress,this.saver);
	},
	onStatusChange   : function() {},
	onLocationChange : function() {},
	onSecurityChange : function() {},
	

};


saver.CaptureObserverCallback = {

	getString : function(aBundleName){ return sbBrowserOverlay.STRING.getString(aBundleName); },

	trace : function(aText)
	{
		try {
			document.getElementById("statusbar-display").label = aText;
		} catch(ex) {
		}
	},

	onDownloadComplete : function(aItem)
	{
		this.trace("CAPTURE" + "... (" + saver.ContentSaver.httpTask[aItem.id] + ") " + aItem.title);
	},

	onAllDownloadsComplete : function(aItem)
	{
		this.trace("CAPTURE_COMPLETE" + ": " + aItem.title);
		this.onCaptureComplete(aItem);
	},

	onDownloadProgress : function(aItem, aFileName, aProgress)
	{
		this.trace("TRANSFER_DATA" + "... (" + aProgress + ") " + aFileName);
	},

	onCaptureComplete : function(aItem)
	{

		if ( aItem && aItem.id in saver.ContentSaver.httpTask ) delete saver.ContentSaver.httpTask[aItem.id];
	},

};

