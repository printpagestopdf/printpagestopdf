Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = [ "simpleDomSaver", ];



var simpleDomSaver = {
	
	get UNICODE() { return Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter); },
	get IO()      { return Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); },
	fixFrames:function(doc){
		var retVal=false;
		if(!doc) return retVal;
		
		var frames=doc.getElementsByTagName( "iframe" );
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
	
	
	saveCookies : function(workDir,aRootWindow){
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

			
			this.writeFile(cookieFile, cookies.join("\r\n"), "UTF-8");			
		}
		
	},
	
	
	fixFormData : function(modDoc,orgDoc){
		
		var inputs=modDoc.getElementsByTagName("input");
		for (var i=0; i < inputs.length;i++) {
			var input=inputs[i];
  			switch(input.type)
			{
				case "text":
					if(input.value)
						input.setAttribute("value",input.value);		
					break;
				case "radio":
				case "checkbox":
					if(input.checked)
						input.setAttribute("checked","checked");
					break;
				default:
					break;

			}
		}

		var options=modDoc.querySelectorAll("option[selected]");
		for (var i=0;i < options.length;i++) {
			var option=options[i];
			option.removeAttribute("selected");
		}
		
		var options=modDoc.querySelectorAll("option[pp2pdf]");
		for (var i=0;i < options.length;i++) {
			var option=options[i];
			option.setAttribute("selected","selected");
			option.removeAttribute("pp2pdf");
		}
		

		var textareas=modDoc.querySelectorAll("textarea[pp2pdf]");
		for (var i=0; i < textareas.length; i++) {
			var textarea=textareas[i];
			//RRprintPages2Pdf.bcs.log(textarea.firstChild.data);
			//RRprintPages2Pdf.bcs.log(textarea.value);
			textarea.firstChild.data=textarea.getAttribute("pp2pdf");
		}
		
	},
	
	preProcessDoc : function(doc){
		var options=doc.getElementsByTagName("option");
		for (var i=0;i < options.length;i++) {
			var option=options[i];
			if(option.selected)
				option.setAttribute("pp2pdf","selected");	
		}
		
		var textareas=doc.getElementsByTagName("textarea");
		for (var i=0; i < textareas.length; i++) {
			var textarea=textareas[i];
			if(textarea.value)
				textarea.setAttribute("pp2pdf",textarea.value);	
		}
		
		var videos=doc.getElementsByTagName("video");
		for (var i=0; i < videos.length; i++) {
			var video=videos[i];
			video.dataset.pp2pdfId="video" + i;
			this.orgNodes[video.dataset.pp2pdfId]=video;
		}
		
		var iframes=doc.getElementsByTagName("iframe");
		for (var i=0; i < iframes.length; i++) {
			var iframe=iframes[i];
			iframe.dataset.pp2pdfId="iframe" + i;
			this.orgNodes[iframe.dataset.pp2pdfId]=iframe;
		}
		
		var objects=doc.getElementsByTagName("object");
		for (var i=0; i < objects.length; i++) {
			var object=objects[i];
			object.dataset.pp2pdfId="object" + i;
			this.orgNodes[object.dataset.pp2pdfId]=object;
		}

	},
	
	_orgNodes:null,
	get orgNodes(){
		if(this._orgNodes == null)
			this._orgNodes={};
		return this._orgNodes;
	},
	
	_xhr : null,	
	get xhr(){
		if(this._xhr == null)
			this._xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
		return this._xhr;	
	},
	
	uriToData : function(url){

		//var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

		this.xhr.open('GET', url, false);
		
		this.xhr.responseType = 'arraybuffer';

		this.xhr.send();		
		
		  if (this.xhr.status != 200) return null;


		    var uInt8Array = new Uint8Array(this.xhr.response);
		    var i = uInt8Array.length;
		    var binaryString = new Array(i);
		    while (i--)
		    {
		      binaryString[i] = String.fromCharCode(uInt8Array[i]);
		    }
		    var data = binaryString.join('');
	
		    var base64 = "data:image/jpg;base64,"+ btoa(data);
		


		return base64;		
	},
	
	_workDir : null,
	fileId : 0,
	
	getElementSize : function(el){
		var style=null;
	},
	
	getGuid : function(){
		var uuidGenerator = Components.classes["@mozilla.org/uuid-generator;1"]
                    .getService(Components.interfaces.nsIUUIDGenerator);
		var uuid = uuidGenerator.generateUUID();
		return uuid.toString().replace(/[{}-]/g,"");
	},
	
	getElementReplace: function(doc,pars){
		var f=pars.node;
		var imgUrl=pars.imgUrl;
		var src=pars.src;
		var width=pars.width;
		var height=pars.height;
		
		//var style = orgElement.contentDocument.defaultView.getComputedStyle(orgElement);		
		
		var vidDiv=doc.createElement("div");
		vidDiv.style.position="relative";
		
		
		var ndImage = doc.createElement("img");
		ndImage.setAttribute("src", imgUrl);
		ndImage.setAttribute("class","pp2imgvideo");
		ndImage.style.width=width + "px";
		ndImage.style.height=height + "px";
		
		vidDiv.appendChild(ndImage);
		
		var ndAnchor=doc.createElement("a");
		ndAnchor.setAttribute("href", src);
		ndAnchor.setAttribute("class","pp2playvideo");
		
		vidDiv.appendChild(ndAnchor);
		vidDiv.style.width=width + "px";
		vidDiv.style.height=height + "px";
		

		return vidDiv;
	},
	
	replaceVideo : function(doc){
		var retVal=false;
		var iframes=doc.getElementsByTagName("iframe");
		var ifReplace=new Array();
		
		lbliframes:
		for(var k=0; k < iframes.length;k++)
		{
			try {
				var iframe = iframes[k];
				var orgIframe = this.orgNodes[iframe.dataset.pp2pdfId]
				var src = iframe.getAttribute("src");
				var orgUri = null;
				if (src.search(/^http:/) == -1) 
					orgUri = "http:" + src;
				else 
					orgUri = src;
				if (src.search(/www.youtube.com\/embed\/videoseries/) != -1) {
					var listid = src.replace(/^.*www.youtube.com\/embed\/videoseries\?list=([^\?]*).*$/, "$1");
					this.xhr.open('GET', "http://gdata.youtube.com/feeds/api/playlists/" + listid, false);
					this.xhr.responseType = "document";
					this.xhr.send();
					
					if (this.xhr.status != 200) 
						continue lbliframes;
					var medias = this.xhr.responseXML.getElementsByTagName("media:thumbnail");
					lblmedia: for (var i = 0; i < medias.length; i++) {
						var media = medias[i];
						var mediaurl = media.getAttribute("url");
						if (mediaurl.search(/hqdefault.jpg$/) != -1) {
							ifReplace.push({
								node: iframe,
								url: mediaurl,
								src: orgUri,
								width: orgIframe.scrollWidth,
								height: orgIframe.scrollHeight
							});
							continue lbliframes;
						}
					}
				}
				else 
					if (src.search(/www.youtube.com\/embed/) != -1) {
						var youtubeid = src.replace(/^.*www.youtube.com\/embed\/([^\?]*).*$/, "$1");
						var youtubeurl = "http://i.ytimg.com/vi/" + youtubeid + "/hqdefault.jpg";
						ifReplace.push({
							node: iframe,
							url: youtubeurl,
							src: orgUri,
							width: orgIframe.scrollWidth,
							height: orgIframe.scrollHeight
						});
						continue lbliframes;
					}
				
				
				if (src.search(/player.vimeo.com\/video\//) != -1) {
					var listid = src.replace(/^.*player.vimeo.com\/video\/(.*)$/, "$1");
					this.xhr.open('GET', "http://vimeo.com/api/v2/video/" + listid + ".xml", false);
					this.xhr.responseType = "document";
					this.xhr.send();
					
					if (this.xhr.status != 200) 
						continue lbliframes;
					var medias = this.xhr.responseXML.getElementsByTagName("thumbnail_large");
					if (medias && medias.length > 0) {
						var mediaurl = medias[0].firstChild.nodeValue;
						ifReplace.push({
							node: iframe,
							url: mediaurl,
							src: orgUri,
							width: orgIframe.scrollWidth,
							height: orgIframe.scrollHeight
						});
						continue lbliframes;
					}
				}
				
			}catch(ex){}
		}
		
		
		var objects=doc.getElementsByTagName("object");
		
		lblobjects:
		for(var k=0; k < objects.length;k++)
		{
			try{
			var object=objects[k];
			var orgObject=this.orgNodes[object.dataset.pp2pdfId]			
			
			var params=object.getElementsByTagName("param");
			for(var i=0; i < params.length;i++){
				if(params[i].getAttribute("name") == "movie"){
					var src=params[i].getAttribute("value");
					var orgUri=null;
					if(src.search(/^http:/) == -1)
						orgUri="http:" + src;
					else
						orgUri=src;
					
					if (src.search(/www.youtube.com\/v/) != -1) {
						var youtubeid = src.replace(/^.*www.youtube.com\/v\/([^\?/]*).*$/, "$1");
						var youtubeurl="http://i.ytimg.com/vi/" + youtubeid + "/hqdefault.jpg";
						ifReplace.push({node:object, url: youtubeurl, src: orgUri, width:orgObject.width, height:orgObject.height});
						continue lblobjects;
					}
					
					if (src.search(/vimeo.com/) != -1) {
						var listid = src.replace(/^.*clip_id=([^&]*).*$/, "$1");
						this.xhr.open('GET', "http://vimeo.com/api/v2/video/" + listid + ".xml", false);
						this.xhr.responseType = "document";
						this.xhr.send();		
				
						if (this.xhr.status != 200) continue lblobjects;
						var medias=this.xhr.responseXML.getElementsByTagName("thumbnail_large");
						if(medias && medias.length > 0){
							var mediaurl=medias[0].firstChild.nodeValue;
							ifReplace.push({node:object, url: mediaurl, src: orgUri, width:orgObject.width, height:orgObject.height,});
							continue lblobjects;
						}
					}					
					
				}
				
			}
			}catch(ex){}
		}
		
		var videos=doc.getElementsByTagName("video");
		var canvas = null;
		
		if (videos.length > 0){
			canvas = doc.createElement("canvas");			
		}
		
		lblvideos:
		for(var k=0; k < videos.length;k++)
		{
			try {
				var video = videos[k];
				var orgVideo = this.orgNodes[video.dataset.pp2pdfId]
				var sources = video.getElementsByTagName("source");
				var orgUri = (sources.length > 0) ? sources[0].getAttribute("src") : "";
				
				canvas.width = orgVideo.scrollWidth;
				canvas.height = orgVideo.scrollHeight;
				var context = canvas.getContext('2d')
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.drawImage(orgVideo, 0, 0, canvas.width, canvas.height);
				
				var mediaurl = canvas.toDataURL();
				ifReplace.push({
					node: video,
					url: null,
					src: orgUri,
					width: canvas.width,
					height: canvas.height,
					imgUrl: mediaurl
				});
			}catch(ex){}
		}
		
		for(var i=0; i < ifReplace.length;i++){			
			try {
				var imgUrl = null;
				if (!ifReplace[i].imgUrl) 
					ifReplace[i].imgUrl = this.uriToData(ifReplace[i].url);
				
				if (ifReplace[i].imgUrl) {
					retVal = true;
					var f = ifReplace[i].node;
					var newNode = this.getElementReplace(doc, ifReplace[i]);
					
					f.parentNode.replaceChild(newNode, f);
					
				}
			}catch(ex){}
		}
		
		return retVal;
	},
	
	copyVideoTemplates : function(doc){
		var templateDir = RRprintPages2Pdf.ExtensionDir.clone();
		templateDir.append(RRprintPages2Pdf.g_const.EXTENSION_TEMPLATEDIR);

		var cpFile=templateDir.clone();
		cpFile.append("play.png");
		cpFile.copyTo(this._workDir,null);
		
		cpFile=templateDir.clone();
		cpFile.append("pp2video.css");
		cpFile.copyTo(this._workDir,null);
		
		var csslink=doc.createElement("link");
		csslink.setAttribute("rel","stylesheet");
		csslink.setAttribute("type","text/css");
		csslink.setAttribute("href",this.IO.newFileURI(cpFile).spec);
		
		doc.head.appendChild(csslink);
		
		
	},
	
	docTypeToStr:function(node){

		return "<!DOCTYPE "
	         + node.name
	         + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
	         + (!node.publicId && node.systemId ? ' SYSTEM' : '') 
	         + (node.systemId ? ' "' + node.systemId + '"' : '')
	         + '>';		
	},
	
	saveOuterHtml: function(workDir,aRootWindow,bReturnUrl)
	{
		var trgFile = workDir.clone();

		trgFile.append("data");
		trgFile.createUnique(trgFile.DIRECTORY_TYPE,0777);
		this._workDir=trgFile.clone();
		trgFile.append("off_content.html")
		
		this.preProcessDoc(aRootWindow.document);

		var doc = aRootWindow.document.implementation.createHTMLDocument('');
		var ndNew=doc.importNode(aRootWindow.document.documentElement,true);
		doc.documentElement.parentNode.replaceChild(ndNew,doc.documentElement);

		try {
			frmFixed=this.fixFrames(doc);
		}catch(e){}

		this.fixFormData(doc,aRootWindow.document);
		
		if(this.replaceVideo(doc))
			this.copyVideoTemplates(doc);
		
		var doctype=aRootWindow.document.doctype?this.docTypeToStr(aRootWindow.document.doctype):"";
		this.writeFile(trgFile,doctype +  doc.documentElement.outerHTML, "UTF-8");
		
		this.saveCookies(workDir,aRootWindow);

		this._orgNodes={};
		
		if(bReturnUrl)
			return this.IO.newFileURI(trgFile).spec;
		else
			return trgFile.path;
		
	},
		

	saveCropFrame: function(workDir,aRootWindow,returnType)
	{
		var trgFile = workDir.clone();

		trgFile.append("data");
		trgFile.createUnique(trgFile.DIRECTORY_TYPE,0777);
		this._workDir=trgFile.clone();
//		trgFile.append("off_content.html")
		trgFile.append(this.getGuid() + ".html");	
		this.preProcessDoc(aRootWindow.document);

		var doc = aRootWindow.document.implementation.createHTMLDocument('');
		var ndNew=doc.importNode(aRootWindow.document.documentElement,true);
		doc.documentElement.parentNode.replaceChild(ndNew,doc.documentElement);
		
		var ndBases=doc.getElementsByTagName("base");
		if (ndBases.length <= 0) {
			var ndBase = doc.createElement("base");
			ndBase.setAttribute("href", aRootWindow.location);
			
			doc.head.insertBefore(ndBase, doc.head.firstChild);
		}
		try {
			frmFixed=this.fixFrames(doc);
		}catch(e){}

		this.fixFormData(doc,aRootWindow.document);
		
		if(this.replaceVideo(doc))
			this.copyVideoTemplates(doc);

		var doctype=aRootWindow.document.doctype?this.docTypeToStr(aRootWindow.document.doctype):"";
		this.writeFile(trgFile,doctype + doc.documentElement.outerHTML, "UTF-8");
		
		this.saveCookies(workDir,aRootWindow);

		this._orgNodes={};
		
		switch(returnType)
		{
			case "dataUrl":
				return this.generateDataURI(trgFile);			
				break;
			case "url":
				return this.IO.newFileURI(trgFile).spec;			
				break;
				
			default:
				return trgFile.path;
				break;
		}
		
	},
		

	saveDOMtoFile: function(workDir,doc,returnType)
	{
		
		var trgFile = null;

		if (workDir || !this._workDir) {
			trgFile = workDir.clone();
			trgFile.append("data");
			trgFile.createUnique(trgFile.DIRECTORY_TYPE, 0777);
			this._workDir = trgFile.clone();
		}
		else
			trgFile=this._workDir.clone();
			
//		trgFile.append("off_content.html")
		trgFile.append(this.getGuid() + ".html");	

		var doctype=doc.doctype?this.docTypeToStr(doc.doctype):"";
		this.writeFile(trgFile,doctype + doc.documentElement.outerHTML, "UTF-8");
		
		switch(returnType)
		{
			case "dataUrl":
				return this.generateDataURI(trgFile);			
				break;
			case "url":
				return this.IO.newFileURI(trgFile).spec;			
				break;
				
			default:
				return trgFile.path;
				break;
		}
		
	},


	generateDataURI : function (file) {
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
}
