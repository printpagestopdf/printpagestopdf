Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = ["_editPage",];

var _editPage=function(){
	
}

_editPage.prototype = {
	
	
	
}


_editPage.prototype.setMainHeader = function(doc,txtHdr){
	var parent=doc.getElementsByTagName("body")[0];
	if (!parent) {
		var head=doc.getElementsByTagName("head")[0];
		if(head && head.firstSibling)
			parent = head.firstSibling;
	}
	if (!parent) {
		parent=doc.getElementsByTagName("html")[0];
	}
	
	if(!parent) return;
	
	var h1=doc.createElement("H1");
	h1.textContent=txtHdr;
	h1.setAttribute("style","display:block;position:absolute;top:0px;left:0px;z-index:-9999;font-size:1px;color:transparent;");
	parent.insertBefore(h1,parent.firstChild);

}

_editPage.prototype.copyStyle=function(win,ndSrc,ndTarget){
	var srcStyle=win.getComputedStyle(ndSrc,null);
	//var srcStyle=ndSrc.style;
	var strStyle="";
	for(var i=0;i < srcStyle.length;i++){
		var propName=srcStyle.item(i);
		var propValue=srcStyle.getPropertyValue(propName);
		strStyle += propName + ":" + propValue + ";"
		//ndTarget.style[propName]=propValue;
	}
	ndTarget.setAttribute("style",strStyle);
}

_editPage.prototype.changeHdrLevel = function(hdr,diff){
	var num=hdr.nodeName.replace(/^h/i,"");
	var newNum=parseInt(num) + diff;
	if( newNum < 1 || newNum > 6) return null;

	var newHdr=hdr.ownerDocument.createElement("h" + newNum);
	var children=hdr.childNodes;
	for(var i=0;i < children.length;i++ )
		newHdr.appendChild(children[i].cloneNode(true));

    if (hdr.hasAttributes()) 
    {
      var attrs = hdr.attributes;
      for(var i=attrs.length-1; i>=0; i--) 
        newHdr.setAttribute(attrs[i].name, attrs[i].value);
    } 
			
	hdr.parentNode.replaceChild(newHdr,hdr);
	
	return newHdr;	
}

_editPage.prototype.removeHeader = function(hdr){
	var doc=hdr.ownerDocument;

	var div=doc.createElement("div");

	var children=hdr.childNodes;
	for(var i=0;i < children.length;i++ )
		div.appendChild(children[i].cloneNode(true));
	
	
	this.copyStyle(doc.defaultView,hdr,div);
	hdr.parentNode.replaceChild(div,hdr);
	
}


_editPage.prototype.cleanHeaders = function(doc){

	for(var i=1; i <= 9;i++){
		var hdrs=doc.getElementsByTagName("h" + i);
		for(var k=hdrs.length-1; k >= 0;k--){
			this.removeHeader(hdrs[k]);
		}
	}
	
}
