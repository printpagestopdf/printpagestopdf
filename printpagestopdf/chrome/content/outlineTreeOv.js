Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};



printPages2Pdf.oTree={
	treeOutline:null,
	cb:null,
	cmd_treeselect:null,
	
	get rowCount(){
		return this.treeOutline.getElementsByTagName("treerow").length;
	},
	
	get selectedItems(){
		var retVal=[];
		var start = new Object();
		var end = new Object();

		var numRanges = this.treeOutline.view.selection.getRangeCount();
		
		for (var t = 0; t < numRanges; t++) {
			this.treeOutline.view.selection.getRangeAt(t, start, end);
			for (var v = start.value; v <= end.value; v++) {
				var ndItem=this.treeOutline.contentView.getItemAtIndex(v);
				retVal.push(ndItem);
			}
		}	
		return retVal;
	},
	
	init:function(){
		this.treeOutline=document.getElementById("treeOutline");
		document.getElementById("outlineToolbar").setAttribute("mode",RRprintPages2Pdf.prefs.getCharPref("ui.toolbarbuttons"));
		
		var me=this;
		this.treeOutline.addEventListener("select",function(evt){me.onSelect(evt);},false)
		var outlineToolbox=document.getElementById("outlineToolbox");
		outlineToolbox.addEventListener("command",function(evt){me.onOutlineButton(evt);},false)
		document.getElementById("ctxMentreeOutline").addEventListener("command",function(evt){me.onOutlineButton(evt);},false)
		
		this.cmd_treeselect=document.getElementById("cmd_treeselect");
	},
	
	setUiinfo:function(nd,prop,val){
		RRprintPages2Pdf.cs.logStringMessage("UIINFO  " + prop)	;

		var uiinfo=nd.getUserData("uiinfo");
		if(!uiinfo)
			uiinfo={};

		uiinfo[prop]=val;
		nd.setUserData("uiinfo",uiinfo,null);
	},
	
	getUiinfo:function(nd,prop){
		var uiinfo=nd.getUserData("uiinfo");
		if(!uiinfo) return null;
		if(prop in uiinfo)
			return uiinfo[prop];
		else
			return null;		
	},
	
	onOutlineButton:function(event){
		
		switch(event.originalTarget.getAttribute("name")){
			case "btOutlineDelete":
				if(!this.cb) return;
				var selItems=this.selectedItems;
				if (selItems.length > 0) {
					for (var i = 0; i < selItems.length; i++) {
						var value = selItems[i].getUserData("value");
						this.setUiinfo(value,"deleted",true);
						this.cb("deleteOutline", value);
					}
					var newSelTreeitem=null;
					var idx = this.treeOutline.contentView.getIndexOfItem(selItems[selItems.length - 1]);
					try{
						newSelTreeitem = this.treeOutline.contentView.getItemAtIndex(idx + 1);
					}catch(e){}
						if (!newSelTreeitem) {
							idx = this.treeOutline.contentView.getIndexOfItem(selItems[0]);
							try{
								newSelTreeitem = this.treeOutline.contentView.getItemAtIndex(idx - 1);
							}catch(e){}
						}
					
					if(newSelTreeitem){
						var value=newSelTreeitem.getUserData("value");
						this.setUiinfo(value,"selected",true);
					}
					this.cb("updateOutline", null);
				}
				break;
			case "btOutlineUnindent":
				if(!this.cb) return;
				var selItems=this.selectedItems;
				var num=0;
				for(var i=0;i < selItems.length;i++){
					var value=selItems[i].getUserData("value");
					var newVal= this.cb("unindentOutline",value);
					if (newVal){
						this.setUiinfo(newVal,"selected",true);
						selItems[i].setUserData("value",newVal,null);
						num++;
					}
				}
				if(num > 0) this.cb("updateOutline",null);
				break;
			case "btOutlineIndent":
				if(!this.cb) return;
				var selItems=this.selectedItems;
				var num=0;
				for(var i=0;i < selItems.length;i++){
					var value=selItems[i].getUserData("value");
					var newVal= this.cb("indentOutline",value);
					if (newVal){
						this.setUiinfo(newVal,"selected",true);
						selItems[i].setUserData("value",newVal,null);
						num++;
					}
				}
				if(num > 0) this.cb("updateOutline",null);
				break;
			case "btHdrClear":
				if(this.cb){
					this.cb("HdrClear",null);
					this.cb("updateOutline",null);
				}
				break;
			case "btHdrTitle":
				if(this.cb){
					this.cb("HdrTitle",null);
					this.cb("updateOutline",null);
				}
				break;
		}
	},
	
	onSelect:function(event){
		
		if (event.target.view.selection.count <= 0) {
			this.cmd_treeselect.setAttribute("disabled","true");
			return;
		}
		
		this.cmd_treeselect.setAttribute("disabled","false");
		this.treeOutline.view.selectionChanged();
		var curTreeItem=event.currentTarget.contentView.getItemAtIndex(event.target.currentIndex);
		
		if(this.cb)
			this.cb("onselect",curTreeItem.getUserData("value"));
	},
	
	getChildrensNode:function(nd){
		var childrensNode=null;
		for(var i=0; i < nd.childNodes.length;i++){
			if(nd.childNodes[i].nodeName == "treechildren"){
				childrensNode=nd.childNodes[i];
				break;
			}
		}
		
		return childrensNode;
	},
	
	get lastItem(){
		var items=this.treeOutline.getElementsByTagName("treeitem");
		if(items.length == 0) return null;
		
		return items[items.length - 1];
	},
	
	getParentItem:function(nd){
		return nd.parentNode.parentNode;
	},
	
	clear:function(){
		var rootitem=document.getElementById("treeRoot");
		
		if(!rootitem || !rootitem.childNodes) return;
		
		while(rootitem.childNodes.length > 0)
			rootitem.removeChild(rootitem.firstChild);
			
	},
	
	markFirstVisibleRowNode:function(){
		var idx=this.treeOutline.treeBoxObject.getFirstVisibleRow();
		var treeitem=null;
		try {
			treeitem = this.treeOutline.contentView.getItemAtIndex(idx);
		}catch(e){ return;}
		
		if (treeitem) {
			var nd = treeitem.getUserData("value");
			this.setUiinfo(nd,"firstvisiblerow",true);							
		}
	},
	
	setFirstVisibleRow:function(){
		if(!this._curFirstTreeItem) return;
		
		var value=this._curFirstTreeItem.getUserData("value");
		
		var idx=-1;
		if(this.getUiinfo(value,"deleted")){
			var selItems=this.selectedItems;
			if (selItems.length <= 0) return;
			idx=this.treeOutline.contentView.getIndexOfItem(selItems[0]);
		}
		else
			idx=this.treeOutline.contentView.getIndexOfItem(this._curFirstTreeItem);
		
		if (idx >= 0) {
			this.treeOutline.treeBoxObject.scrollToRow(idx);
		}
	},
	
	
	_curFirstTreeItem:null,
	appendChildAt:function(label,value,lvl){
		var treeitem=this.newTreeItem(label,value,lvl);
		
		var parentItem=this.lastItem;

		if (!parentItem) 
			parentItem = this.treeOutline;

		
		var parentLvl=parentItem.getAttribute("level");
		while(parentLvl >= lvl){
			parentItem = this.getParentItem(parentItem);
			parentLvl=parentItem.getAttribute("level");
		}
		
		this.getChildrensNode(parentItem).appendChild(treeitem);
		parentItem.setAttribute("container",true);
		parentItem.setAttribute("open",true);
		
		if (this.getUiinfo(value,"selected") === true) {
			var idxTreeitem = this.treeOutline.contentView.getIndexOfItem(treeitem);
			this.treeOutline.view.selection.rangedSelect(idxTreeitem, idxTreeitem, true);
			this.setUiinfo(value,"selected",false);				
		}
		
		if(this.getUiinfo(value,"firstvisiblerow") === true){
			this._curFirstTreeItem=treeitem;
			this.setUiinfo(value,"firstvisiblerow",false);				
		}
	},
	
	
	newTreeItem:function(label,value,lvl){
		var treeitem=document.createElement("treeitem");
		var treerow=document.createElement("treerow");
		var treecell=document.createElement("treecell");
		var treechildren=document.createElement("treechildren");
		
		treecell.setAttribute("label",label);
		
		if(value)
			treeitem.setUserData("value",value,null);
		
		if(lvl)
			treeitem.setAttribute("level",lvl);
		
		treerow.appendChild(treecell);
		treeitem.appendChild(treerow);
		treeitem.appendChild(treechildren);
		
		return treeitem;
	},
	
	appendChild:function(label,value,parent){
		var treeitem=this.newTreeItem(label,value);
		
		var ndParent=(parent)?parent:this.treeOutline;
		var childrensNode=null;
		for(var i=0; i < ndParent.childNodes.length;i++){
			if(ndParent.childNodes[i].nodeName == "treechildren"){
				childrensNode=ndParent.childNodes[i];
				break;
			}
		}
		
		ndParent.setAttribute("container",true);
		return childrensNode.appendChild(treeitem);
		
	},
}


window.addEventListener("load",function(){
	printPages2Pdf.oTree.init();
},false);
