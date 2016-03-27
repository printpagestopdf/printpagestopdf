Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};
Components.utils.import("resource://printPages2PdfMod/thumbs.jsm",printPages2Pdf);


printPages2Pdf.dirlister = {  
	_divDirList : null,
	_baseDir : "G:\\temp\\pdfArchive1",
	_iframe : null,
	_frmslider : null,
	_slider : null,
	_imgRule:null,
	file : Components.classes["@mozilla.org/file/local;1"].
           createInstance(Components.interfaces.nsILocalFile),	
	_IO : Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),
		
	
	onSliderChange : function(event){
		alert("RULE: " + this._imgRule);
		if(!this._imgRule)return;
		
		this._imgRule.style.width = this._slider.value + "px";
		alert(this._imgRule.style.width);
	},
	
	getImageCSS:function(){
		var s="";
		var imgRule=null;
		var myStyleSheets = document.styleSheets;
		for ( var i=0; i<myStyleSheets.length; i++ )
		{
			var rules=myStyleSheets[i].cssRules;
			for(var r=0; r < rules.length;r++){
				if(rules[r].selectorText == ".thumb_img_div"){
					imgRule=rules[r];
				}
			}
		}		
		return imgRule;
	},
		   
	listDir : function()
	{
		var pars=this.getParams(location.search);
		
		if(!pars.dir) return;
		
		this._imgRule=this.getImageCSS();
		var rule=this._imgRule;
		
		this._baseDir=pars.dir;
		this._slider=document.getElementById("frmSlider").contentDocument.getElementById("slider");
		this._slider.addEventListener("change",function(event){
			if(!rule)return;
			
			rule.style.width = event.currentTarget.value + "px";
		}
		,true);
		this._slider.value="160";
		this._iframe = document.getElementById("ifrthumb");
		
		var fldr=document.getElementById("foldername");
		this.file.initWithPath(this._baseDir);
		var txtFolder=document.createTextNode(RRprintPages2Pdf.strb.formatStringFromName("dirlister.title",[this.file.leafName],1));
		fldr.setAttribute("title",this.file.path);
		fldr.replaceChild(txtFolder,fldr.firstChild);

		var size=document.getElementById("strsize");
		var txtSize=document.createTextNode(RRprintPages2Pdf.strb.GetStringFromName("dirlister.size"));
		size.replaceChild(txtSize,size.firstChild);

		this._divDirList = document.getElementById("dirlist");
		
		this.listFromDir();
	},
	
	getParams:function(pars){
		var ret={};
		var ar=pars.replace(/^\?/,"").split("=");
		
		
		for(var i=0;i < ar.length;i += 2){
			ret[ar[i]]=decodeURIComponent(ar[i + 1]);
		}
		
		return ret;
	},
	
	listFromDir : function(){
		
 	  	this.file.initWithPath(this._baseDir);	

		var entries = this.file.directoryEntries;
		var idx=0;
		for(var idx=0;this.file.directoryEntries.hasMoreElements();idx++)
		{
			try {
			   var entry = entries.getNext();
			   if(!entry) break; //XPCOMM error???
		  		entry.QueryInterface(Components.interfaces.nsIFile);

				var imgFile=RRprintPages2Pdf.getThumbFile(entry,"png");
				if(imgFile != null)
				{
					this._divDirList.appendChild(this.createImgEntry(entry,imgFile,idx));
				}
			}
			catch(e) {alert(e);};
			
		}
				
	},
	
	fileInfo:function(file){
		var dt=new Date();
		dt.setTime(file.lastModifiedTime);
		
		var size="";
		if(file.fileSize > 1024)
			size=(file.fileSize / 1024).toFixed(3) + " KB";
		else if(file.fileSize > (1024 * 1024))
			size=(file.fileSize / (1024 * 1024)).toFixed(3) + "MB";
		else if(file.fileSize > (1024 * 1024 * 1024))
			size=(file.fileSize / (1024 * 1024 * 1024)).toFixed(3) + " GB";
		else if(file.fileSize > (1024 * 1024 * 1024 * 1024))
			size=(file.fileSize / (1024 * 1024 * 1024 * 1024)).toFixed(3) + " TB";


		var str=file.leafName + "\r\n" + dt.toLocaleString() + "\r\n" + size;
		
		return str;
	},
	
	createImgEntry :function(pdfFile,imgFile,idx){
		var imgExist=false;
		
		var strFileInfo=this.fileInfo(pdfFile);
		
		var outerDiv=document.createElement("div");
		outerDiv.setAttribute("class","thumb_img_div");
		
		var linkDiv=document.createElement("div");
		linkDiv.setAttribute("class","thumb_link_div");
		linkDiv.title = strFileInfo;
		
		var aTxt=document.createElement("a");
		aTxt.target="_blank";
		aTxt.href = this._IO.newFileURI(pdfFile).spec;
		var txt=document.createTextNode(pdfFile.leafName);
		aTxt.appendChild(txt);		
		aTxt.tile=strFileInfo;
		linkDiv.appendChild(aTxt);
		
		outerDiv.appendChild(linkDiv);
				
		var a=document.createElement("a");
		a.target="_blank";
		a.href = this._IO.newFileURI(pdfFile).spec;			

		var img=document.createElement("img");
		img.setAttribute("class","thumb_img");
		img.id = "img_" + idx;
		if (imgFile.exists()) {
			img.src = this._IO.newFileURI(imgFile).spec;
			imgExist=true;
		}
		else
		{
			img.src = "chrome://printPages2Pdf/skin/icon_loading_75x75.gif";
		}	
		img.title=strFileInfo;		

		a.appendChild(img);
		outerDiv.appendChild(a);
		
		if (!imgExist) {
			var objArgs={id : "img_" + idx};
			printPages2Pdf._thumbs.prototype.create(this._iframe,pdfFile, this, objArgs);
		}
		
		return outerDiv;
	},
	
	displayThumb: function(imageFile, objArgs){
		var img=document.getElementById(objArgs.id);
		if(img){
			img.src = this._IO.newFileURI(imageFile).spec;			
		}
	},	
}

