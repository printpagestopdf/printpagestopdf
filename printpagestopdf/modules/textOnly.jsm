Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 




var EXPORTED_SYMBOLS = ["textOnly", ];

var textOnly = {
	
	cleanWindow: function(win){
		this.traverseDOM(win);		
	},
	
	traverseDOM : function (win){
		for(var i=0; i < win.frames.length;i++){
			this.traverseDOM(win.frames[i]);
		}
		
		this.traverseFrameDOM(win.document.getElementsByTagName('html')[0]);
	},

	traverseFrameDOM : function(doc){
	
		if ("removeAttribute" in doc ) {
			if(doc.hasAttribute("style")) doc.removeAttribute("style");
			if(doc.hasAttribute("background")) doc.removeAttribute("background");
		}
		if(! doc.hasChildNodes()) return;
		
		for(var i=doc.childNodes.length - 1;i >=0;i--){
			var nd=doc.childNodes[i];
			
			switch(nd.nodeName.toLowerCase()){
				case "img":
				case "embed":
				case "map":
				case "area":
				case "object":
				case "link":
				case "style":
				case "script":
				case "svg":
					doc.removeChild(nd);
					break;
				case "textarea":
					var txt=null;
					if(nd.value) 
						txt=nd.value;
					else if (nd.textContent)
						txt=nd.textContent;
					if(txt){
						var div=nd.ownerDocument.createElement("div");
						div.textContent=txt;
						doc.replaceChild(div,nd);					
					}
					else
						doc.removeChild(nd);
					break;
				case "input":
					var txt=null;
					switch (nd.type.toLowerCase()) {
						case "text":
						case "date":
						case "datetime":
						case "datetime-local":
						case "email":
						case "month":
						case "number":
						case "search":
						case "tel":
						case "text":
						case "time":
						case "url":
						case "week":
						case "checkbox": 
						case "radio": 
							if(nd.textContent){
								txt=nd.textContent;
							}
							else if(nd.value){
								txt=nd.value;
							}
							break;
						default:
							break;
					}
					if(txt){
						var div=nd.ownerDocument.createElement("div");
						div.textContent=txt;
						doc.replaceChild(div,nd);					
					}
					else
						doc.removeChild(nd);
					break;
				case "select":
					var txt=null;
					if(nd.value) 
						txt=nd.value;
					if(txt){
						var div=nd.ownerDocument.createElement("div");
						div.textContent=txt;
						doc.replaceChild(div,nd);					
					}
					else
						doc.removeChild(nd);
				case "table":
					nd.style.emptyCells="hide";
					this.traverseFrameDOM(nd);
					break;
				default:
					this.traverseFrameDOM(nd);
					break;
			}
		}	
	},
	
	isToRemove : function (nd){
		var retVal=false;
		
		var name=nd.nodeName.toLowerCase();
		
		switch(name){
			case "img":
			case "link":
			case "style":
			case "script":
			case "svg":
			case "input":
			case "button":
				retVal=true
				break;
			default:
				retVal=false;
		}
		
		return retVal;
	},	
	
}
