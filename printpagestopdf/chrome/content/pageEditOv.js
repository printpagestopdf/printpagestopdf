Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
Components.utils.import("resource://gre/modules/Geometry.jsm");
/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/editPage.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/textOnly.jsm",printPages2Pdf);


printPages2Pdf.DOMEraser = {

	enabled : false,
	verbose : 0,
	evtFunction: null,
	cbNotify:null,
	arUndo: new Array(),
	
	flattenFrames : function(aWindow)
	{
		var ret = [aWindow];
		for ( var i = 0; i < aWindow.frames.length; i++ )
		{
			ret = ret.concat(this.flattenFrames(aWindow.frames[i]));
		}
		return ret;
	},

	removeStyle : function(aWindow, aID)
	{
		try { 
			var style=aWindow.document.getElementById(aID);
			style.parentNode.removeChild(style); 
		} catch(ex) {}
	},
	
	applyStyle : function(aWindow, aID, aString)
	{
		if ( aWindow.document.getElementById(aID) )
		{
			return;
		}
		var newNode = aWindow.document.createElement("style");
		newNode.setAttribute("media", "screen");
		newNode.setAttribute("type", "text/css");
		newNode.setAttribute("id", aID);
		newNode.appendChild(aWindow.document.createTextNode(aString));
		var headNode = aWindow.document.getElementsByTagName("head")[0];
		if ( headNode ) headNode.appendChild(newNode);
	},
	
	
	init : function(win,enabled)
	{
		this.arUndo=new Array();
		this.enabled=enabled;
		this.verbose = 0;
		if(!this.evtFunction){
			var me=this;
			this.evtFunction=function(evt){return me.handleEvent(evt);};
		}
		
		var frameList = this.flattenFrames(win);
		for ( var i = 0; i < frameList.length; i++ )
		{
			frameList[i].document.removeEventListener("mouseover", this.evtFunction, true);
			frameList[i].document.removeEventListener("mousemove", this.evtFunction, true);
			frameList[i].document.removeEventListener("mouseout",  this.evtFunction, true);
			frameList[i].document.removeEventListener("click",     this.evtFunction, true);
			if ( this.enabled ) {
				frameList[i].document.addEventListener("mouseover", this.evtFunction, true);
				frameList[i].document.addEventListener("mousemove", this.evtFunction, true);
				frameList[i].document.addEventListener("mouseout",  this.evtFunction, true);
				frameList[i].document.addEventListener("click",     this.evtFunction, true);
			}
			if ( this.enabled ) {
				var estyle = "* { cursor: crosshair; }\n"
				           + "#printPages2Pdf-eraser-tooltip { -moz-appearance: tooltip;"
				           + " position: absolute; z-index: 10000; margin-top: 32px; padding: 2px 3px; max-width: 40em;"
				           + " border: 1px solid InfoText; background-color: InfoBackground; color: InfoText; font: message-box; }";
				this.applyStyle(frameList[i], "printPages2Pdf-eraser-style", estyle);
			} else {
				this.removeStyle(frameList[i], "printPages2Pdf-eraser-style");
			}
		}
	},

	handleEvent : function(aEvent)
	{
		if(!aEvent.target || !aEvent.target.ownerDocument) return;
		aEvent.preventDefault();
		var elem = aEvent.target;
		if (elem.localName) {
			var tagName = elem.localName.toUpperCase();
			if (aEvent.type != "keypress" && ["SCROLLBAR", "HTML", "BODY", "FRAME", "FRAMESET"].indexOf(tagName) >= 0) 
				return;
		}
		if ( aEvent.type == "mouseover" || aEvent.type == "mousemove" )
		{
			if ( aEvent.type == "mousemove" && ++printPages2Pdf.DOMEraser.verbose % 3 != 0 ) return;
			var tooltip = elem.ownerDocument.getElementById("printPages2Pdf-eraser-tooltip");
			if ( !tooltip )
			{
				tooltip = elem.ownerDocument.createElement("DIV");
				tooltip.id = "printPages2Pdf-eraser-tooltip";
				elem.ownerDocument.body.appendChild(tooltip);
			}
			tooltip.style.left = aEvent.pageX + "px";
			tooltip.style.top  = aEvent.pageY + "px";
			if ( aEvent.type == "mouseover" )
			{
				tooltip.textContent = elem.localName;
				if ( elem.id ) tooltip.textContent += ' id="' + elem.id + '"';
				if ( elem.className ) tooltip.textContent += ' class="' + elem.className + '"';
				elem.style.MozOutline =  "2px solid #FF0000";
				elem.style.outline= "2px solid #FF0000";
			}
		}
		else if ( aEvent.type == "mouseout" )
		{
			var tooltip = elem.ownerDocument.getElementById("printPages2Pdf-eraser-tooltip");
			if ( tooltip ) elem.ownerDocument.body.removeChild(tooltip);
			if (!elem.getAttribute("data-pp2pdf-selected")) {
				elem.style.MozOutline = "";
				elem.style.outline = "";
			}
			if ( !elem.getAttribute("style") ) elem.removeAttribute("style");
		}
		else if ( aEvent.type == "click" )
		{
			var tooltip = elem.ownerDocument.getElementById("printPages2Pdf-eraser-tooltip");
			if ( tooltip ) elem.ownerDocument.body.removeChild(tooltip);
			if (!aEvent.ctrlKey) {
				elem.style.MozOutline = "";
				elem.style.outline = "";
			}
			if ( !elem.getAttribute("style") ) elem.removeAttribute("style");
			if ( aEvent.shiftKey || aEvent.button == 2 )
			{
				printPages2Pdf.DOMEraser.isolateNode(elem);
				if(this.cbNotify) this.cbNotify("isolate");
				
			}
			else if (aEvent.ctrlKey && !elem.getAttribute("data-pp2pdf-selected"))
			{
				elem.setAttribute("data-pp2pdf-selected","true");
			}
			else
			{
				if (elem.ownerDocument.defaultView && elem.ownerDocument.defaultView.getSelection().toString()) {
					try {
						elem.ownerDocument.defaultView.getSelection().deleteFromDocument();
					}catch(e){}
				}
				else {
					elem.setAttribute("data-pp2pdf-selected","true");
					this.removeSelected(elem.ownerDocument);
					printPages2Pdf.pageEdit.btUndo.disabled=false;
					//elem.parentNode.removeChild(elem);
				}
				if(this.cbNotify) this.cbNotify("delnode");
			}
			this.changed1 = true;
			printPages2Pdf.pageEdit.buildOutlineTree();
		}
	},
	
	
	removeElement:function(elem){
		elem.setAttribute("data-pp2pdf-orgstyle",elem.style);
		elem.style.display="none";
		elem.style.visibility="collapse";
		this.arUndo.push(elem);
		elem.removeAttribute("data-pp2pdf-selected");
		
	},
	
	removeSelected:function(doc){
		var selected=doc.querySelectorAll("*[data-pp2pdf-selected]");
		for(var i=0;i < selected.length;i++){
			this.removeElement(selected[i]);
		}
		
	},
	
	clearSelection:function(doc){
		var selected=doc.querySelectorAll("*[data-pp2pdf-selected]");
		for(var i=0;i < selected.length;i++){
			selected[i].style=selected[i].getAttribute("data-pp2pdf-orgstyle");
			selected[i].removeAttribute("data-pp2pdf-orgstyle");
			selected[i].removeAttribute("data-pp2pdf-selected");
		}
	},

	isolateNode : function(aNode)
	{
		if ( !aNode || !aNode.ownerDocument.body ) return;
		while (aNode.ownerDocument.body.childNodes.length > 0) 
			try {
				aNode.ownerDocument.body.removeChild(aNode.ownerDocument.body.firstChild);
			}catch(e){}
		
		aNode.ownerDocument.body.appendChild(aNode);
		return;		
	},

};


printPages2Pdf.pageEdit = {
	isInit:false,
	editBrowser:null,
	btSaveEditWin:null,
	busyIndicator:null,
	outlineTree:null,
	srcObject:null,
	btUndo:null,
	
	progressObserver: {
		parent:null,
		observerCache:{},

		
		onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
		{			
			if (aStateFlags & (Components.interfaces.nsIWebProgressListener.STATE_START | Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW)) {
				this.parent.hideBusy(false);
				if (aRequest && aRequest.name) {
					this.observerCache[aRequest.name] = 1;
				}
			}
			if(aStateFlags & (Components.interfaces.nsIWebProgressListener.STATE_STOP |Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW)){
				if(aRequest && aRequest.name){
					try {
						delete this.observerCache[aRequest.name];
					}catch(e){}
				}

				if (Object.keys(this.observerCache).length == 0 || this.parent.editBrowser.contentWindow.location == aRequest.name) {
					this.observerCache = {};
					this.parent.buildOutlineTree();
					this.parent.hideBusy(true);
				}
					
			}
			
			
		},
		
		onProgressChange : function( aWebProgress,  aRequest,  aCurSelfProgress,  aMaxSelfProgress,  aCurTotalProgress,  aMaxTotalProgress) {
		},
		onStatusChange   : function() {},
		onLocationChange : function(aWebProgress,aRequest,aLocation,aFlags) {
			if(this.parent.srcObject && aRequest && aRequest.name && 
					this.parent.srcObject.localUrl != aRequest.name &&
					this.parent.srcObject.localUrl.search(/\.pdf$/i) < 0 &&
					aRequest.name.search(/\.pdf$/i) < 0 )
				this.parent.isDocEdited=true;
		},
		
		onSecurityChange : function() {},
		
		QueryInterface: function(aIID)
		  {
		   if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
		       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
		       aIID.equals(Components.interfaces.nsISupports))
		     return this;
		   throw Components.results.NS_NOINTERFACE;
		  },		
	},	
	
	_isDocEdited:false,
	set isDocEdited(val){

		if(val == true)
			this.btSaveEditWin.disabled=false;
		else
			this.btSaveEditWin.disabled=true;
			
		this._isDocEdited=val;		
	},

	get isDocEdited(){
		return this._isDocEdited;
	},
	
	hideBusy:function(state){
		this.busyIndicator.hidden=state
	},
	
	askForSaving:function(unconditional){
		var retVal=true;
		if(unconditional || this.isDocEdited){
			var prompt=Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
			var button = prompt.BUTTON_TITLE_SAVE * prompt.BUTTON_POS_0 + prompt.BUTTON_TITLE_DONT_SAVE * prompt.BUTTON_POS_1;
			var ret = prompt.confirmEx(window,RRprintPages2Pdf.strb.GetStringFromName("application.dispname"), 
							RRprintPages2Pdf.strb.GetStringFromName("saveconfirm.label"), button, null, null, null, null, {});
			if ( ret == 0 ) this.onEditCmd({
				originalTarget: {
					id: "btSaveEditWin"
				}
			});
			
		}
		
		return retVal;
	},
	
	onBeforeUnload:function(event){
	},
	
	cbDOMEraser:function(reason){
		this.isDocEdited=true;
	},
	 	
	deinit:function(){
		if (this.editBrowser) 
			this.editBrowser.webProgress.removeProgressListener(this.progressObserver);
		if(this.outlineTree)
			this.outlineTree.clear();		
		
	},
		
	init:function(outlineTree){
		if(this.isInit) return;
		
		this.outlineTree=outlineTree;
		var me=this;
		printPages2Pdf.DOMEraser.cbNotify = function(par){
			me.cbDOMEraser(par);
		};
		
		if(!this.editBrowser){
			this.progressObserver.parent=this;
			//this.editBrowser=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","browser");
			this.editBrowser=document.getElementById("editBrowser");
			//this.editBrowser.setAttribute("flex","1");
			//this.editBrowser.setAttribute("type","content");
			//this.editBrowser.setAttribute("transparent","transparent");
			//var parent=document.getElementById("browserBox");
			//parent.appendChild(this.editBrowser);
			//parent.insertBefore(this.editBrowser,parent.firstChild);
			


			this.editBrowser.webProgress.addProgressListener(this.progressObserver,
							Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW |
							Components.interfaces.nsIWebProgress.NOTIFY_LOCATION |
							Components.interfaces.nsIWebProgress.NOTIFY_STATUS);

							
		}
		
		document.getElementById("editToolbar").setAttribute("mode",RRprintPages2Pdf.prefs.getCharPref("ui.toolbarbuttons"));
		
		this.browserBox=document.getElementById("browserBox");
		this.busyIndicator=document.getElementById("busyIndicator");
		this.btDeleteSel=document.getElementById("btDeleteSel");
		this.btUndo=document.getElementById("btUndo");
		this.btSaveEditWin=document.getElementById("btSaveEditWin");
		var me=this;
		this.browserBox.addEventListener("command",function(evt){me.onEditCmd(evt);});
		this.outlineTree.cb = function(reason, value){
			return me.onOutlineTree(reason, value);
		};
		
		this.isInit=true;		
	},
	
	onEditCmd:function(event){
		switch(event.originalTarget.id){
			case "btH1":
			case "btH2":
			case "btH3":
			case "btH4":
			case "btH5":
			case "btH6":
				var sel=this.editBrowser.contentWindow.getSelection();
				if (sel.rangeCount <= 0) {
					var prompt=Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
					prompt.alert(window,
							RRprintPages2Pdf.strb.GetStringFromName("application.dispname"),
							RRprintPages2Pdf.strb.GetStringFromName("selecttext.hint.label"));
					return;
				}

				var selStr=sel.toString();
				var rg=sel.getRangeAt(0);
				var strEl=event.originalTarget.id.replace(/^bt/,"");
				var masterDiv=this.editBrowser.contentDocument.createElement("span");
//				var masterDiv=this.editBrowser.contentDocument.createElement("h2");
				
				rg.surroundContents(masterDiv);

				var strEl=event.originalTarget.id.replace(/^bt/,"");
				var contentHdr=this.editBrowser.contentDocument.createElement(strEl);
				contentHdr.textContent=selStr;
//				contentHdr.setAttribute("style","display:inline;position:absolute;z-index:-9999;font-size:1px;color:transparent;overflow:hidden;padding:0px;margin:0px;");
				contentHdr.setAttribute("style","display:inline;position:absolute;z-index:-9999;color:transparent;background-color:transparent;overflow:hidden;padding:0px;margin:0px;");
				
				masterDiv.insertBefore(contentHdr,masterDiv.firstChild);

				this.buildOutlineTree();
				this.isDocEdited=true;
				break;
			case "btSaveEditWin":
				printPages2Pdf.DOMEraser.clearSelection(this.editBrowser.contentDocument);
				this.srcObject._saveEditWin(this.editBrowser.contentWindow);
				this.isDocEdited=false;
				printPages2Pdf.DOMEraser.init(this.editBrowser.contentWindow,false);
				this.btDeleteSel.checked=false;
				break;
			case "btReload":
//				this.editBrowser.addEventListener("DOMContentLoaded",this.initTreeFunc,false);	
				this.progressObserver.observerCache={};
				this.editBrowser.webNavigation.reload(0);
				this.isDocEdited=false;
				this.btDeleteSel.checked=false;
				break;
			case "btUndo":
				var el=printPages2Pdf.DOMEraser.arUndo.pop();
				if(el)			
					el.style=el.getAttribute("data-pp2pdf-orgstyle");

				if(printPages2Pdf.DOMEraser.arUndo.length == 0)
					this.btUndo.disabled=true;
				break;
			case "btDeleteSel":
				printPages2Pdf.DOMEraser.init(this.editBrowser.contentWindow,event.originalTarget.checked);
				//this.btUndo.disabled=false;
				break;
			case "btTextOnly":
				printPages2Pdf.textOnly.cleanWindow(this.editBrowser.contentWindow);
				this.isDocEdited=true;
				printPages2Pdf.DOMEraser.init(this.editBrowser.contentWindow,false);
				this.btDeleteSel.checked=false;
				break;
			case "btNote":
				return;
				var me=this;
				this.editBrowser.contentWindow.addEventListener("click",function(evt){return me.onMouseEvent(evt);},true);
				return;

/*
				this.editBrowser.contentWindow.addEventListener("mousedown",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentWindow.addEventListener("mouseup",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentWindow.addEventListener("mousemove",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentWindow.addEventListener("mouseout",function(evt){return me.onMouseEvent(evt);},true);

*/
				

				this.editBrowser.contentDocument.documentElement.addEventListener("dragover",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentDocument.documentElement.addEventListener("dragstart",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentDocument.documentElement.addEventListener("dragenter",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentDocument.documentElement.addEventListener("drop",function(evt){return me.onMouseEvent(evt);},true);
				this.editBrowser.contentDocument.documentElement.setAttribute("draggable","true");



				this.markerDiv=this.editBrowser.contentDocument.createElement("div");
//				this.markerDiv.setAttribute("style","background: rgba(200, 54, 54, 0.5);position:absolute;");
				this.markerDiv.setAttribute("style","background: rgba(200, 54, 54, 0.5);position:absolute;z-index:9999;");
				this.editBrowser.contentDocument.getElementsByTagName("body")[0].appendChild(this.markerDiv);
				this.buttonDown=-1;
				break;
		}
	},
	
	
	
	onMouseEvent:function(event){
		switch(event.type){
			case "click":
				var target=event.originalTarget;
				var tb=this.editBrowser.contentDocument.createElement("textarea");
				tb.name="printPages2Pdf";
				target.parentNode.insertBefore(tb,target);
				event.preventDefault();
				break;
			case "drop":
					var left=this.markerDiv.style.left.replace(/px/,"");
					var top=this.markerDiv.style.top.replace(/px/,"");
					this.markerDiv.style.width = (event.pageX - left) + "px";
					this.markerDiv.style.height = (event.pageY - top) + "px";
					
					
					event.preventDefault();
					event.stopPropagation();
					
				break;
			case "dragover":
					var left=this.markerDiv.style.left.replace(/px/,"");
					var top=this.markerDiv.style.top.replace(/px/,"");
					this.markerDiv.style.width = (event.pageX - left) + "px";
					this.markerDiv.style.height = (event.pageY - top) + "px";
					event.preventDefault();
					event.stopPropagation();
				break;
			case "dragenter":
				event.dataTransfer.effectAllowed="copy";
					event.preventDefault();
					event.stopPropagation();
				break;
			case "dragstart":
				event.dataTransfer.setData("x-application/printPages2PdfDummy", "Text to drag");
				event.dataTransfer.effectAllowed="all";
				
				  var canvas = document.createElementNS("http://www.w3.org/1999/xhtml","canvas");  
				  canvas.width = canvas.height = 0;  
				  
				  var ctx = canvas.getContext("2d");  
				  ctx.lineWidth = 0;  
				  ctx.moveTo(0, 0);  
				  ctx.lineTo(0, 0);  
				  ctx.moveTo(0, 0);  
				  ctx.lineTo(0, 0);  
				  ctx.stroke();  
				  
				  event.dataTransfer.setDragImage(canvas, 0, 0);  				
				   				
				this.markerDiv.style.left=event.pageX + "px";
				this.markerDiv.style.top=event.pageY + "px";				
				this.markerDiv.style.width="0px";
				this.markerDiv.style.height= "0px";				

				break;
			case "mousedown":
				this.buttonDown=event.button;
				this.markerDiv.style.left=event.pageX + "px";
				this.markerDiv.style.top=event.pageY + "px";				
				this.markerDiv.style.width="0px";
				this.markerDiv.style.height= "0px";				
				break;
			//case "mouseout":
			case "mouseup":
				this.buttonDown=-1;
				break;
			case "mousemove":
				if (this.buttonDown == 0) {
					var left=this.markerDiv.style.left.replace(/px/,"");
					var top=this.markerDiv.style.top.replace(/px/,"");
					this.markerDiv.style.width = (event.pageX - left) + "px";
					this.markerDiv.style.height = (event.pageY - top) + "px";
					
				}				
				break;			
		}
		//event.preventDefault();
		//event.stopPropagation();
	},
	
	
	loadObject:function(srcObject){
		this.askForSaving();
		this.isDocEdited=false;
		this.srcObject=srcObject;
		this.hideBusy(false);

		var outline=document.getElementById("boxOutlineTree");
		outline.setAttribute("hidden",false);
		
		var editToolbox=document.getElementById("editToolbox");
		editToolbox.setAttribute("hidden",false);

		
		this.progressObserver.observerCache={};
		var localUrl=this.srcObject.localUrl;
		this.hideBusy(true);
//		this.editBrowser.setAttribute("src",localUrl);

		this.editBrowser.webNavigation.loadURI(localUrl,0,null,null,null);
		this.isDocEdited=false;
	},

	onOutlineTree:function(reason,data){
		switch(reason){
			case "onselect":
				if(data){
					data.scrollIntoView(true);
				}
				break;
			case "deleteOutline":				
				printPages2Pdf._editPage.prototype.removeHeader(data);
				this.isDocEdited=true;
				break;
			case "updateOutline":
				this.buildOutlineTree();
				break;
			case "unindentOutline":
				this.isDocEdited=true;
				return printPages2Pdf._editPage.prototype.changeHdrLevel(data,-1);
				break;
			case "indentOutline":
				this.isDocEdited=true;
				return printPages2Pdf._editPage.prototype.changeHdrLevel(data,1);
				break;
			case "HdrClear":
				printPages2Pdf._editPage.prototype.cleanHeaders(this.editBrowser.contentDocument);
				this.isDocEdited=true;
				break;
			case "HdrTitle":
				printPages2Pdf._editPage.prototype.setMainHeader(this.editBrowser.contentDocument,this.srcObject.Title);
				this.isDocEdited=true;
				break;
				
		}
	},

	
	buildOutlineTree:function(){
//RR bugfix 0.1.9.1??
//		this.outlineTree.markFirstVisibleRowNode();	
		this.outlineTree.clear();
		var treeWalker = this.editBrowser.contentDocument.createTreeWalker(
	    this.editBrowser.contentDocument,
	    NodeFilter.SHOW_ELEMENT,
	    { acceptNode: function(node) {
			if (RegExp(/^h[1-6]$/i).test( node.nodeName)) {
				return NodeFilter.FILTER_ACCEPT;
			}
			} 
		},
	    false
		);
	
		while(treeWalker.nextNode()){
			var lvl=treeWalker.currentNode.nodeName.replace(/^h/i,"");
			this.outlineTree.appendChildAt(treeWalker.currentNode.textContent,
						treeWalker.currentNode,lvl);
		}
		
		try {
			this.outlineTree.setFirstVisibleRow();
		}catch(e){dump(e + "\r\n");}		
	},	
}