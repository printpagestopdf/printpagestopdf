Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);

printPages2Pdf.bookmarks = {
	getSelectionNodes : function(pNd,bRecurseAll){
		
		var maxDepth=(bRecurseAll)?Number.MAX_VALUE:0;
		var view = PlacesUIUtils.getViewForNode(pNd);
		var nodes = [];
		if (view.nodeName == "tree") {
			var selection = view.view.selection;
			var rc = selection.getRangeCount();
			var resultview = view.view;
			for (var i = 0; i < rc; ++i) {
				var min = {}, max = {};
				selection.getRangeAt(i, min, max);
				
				for (var j = min.value; j <= max.value; ++j) {
					this.recurseNodes(resultview.nodeForTreeIndex(j),nodes,0,maxDepth);
				}
			}
		}
		else {
			this.recurseNodes(view.selectedNode,nodes,0,maxDepth);
		}
		return nodes;
	},
	
	
	recurseNodes: function(nd,nodes,depth,maxDepth){
		if(! nd) return;
		switch(nd.type)
		{
			case Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_URI:
				nodes.push(nd);
				break;
			
			case Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT:
			case Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_FOLDER:
/*			case Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_DYNAMIC_CONTAINER:*/
			case Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_QUERY:
				if(depth > maxDepth) break;
				var containerStatus=nd.containerOpen;
				nd.containerOpen=true;
				for(var i=0; i < nd.childCount;i++){
					this.recurseNodes(nd.getChild(i),nodes,depth +1,maxDepth);
				}
				nd.containerOpen=containerStatus;
				break;
			
		}
	},
	
	printSelection: function(uiNode,bRecurseAll,bTextOnly){
//		var nodes=this.getSelectionNodes(document.popupNode,bRecurseAll);
		var nodes=this.getSelectionNodes(uiNode,bRecurseAll);
		if((! nodes) || nodes.length == 0) return;
		
		var urlLst=[];
		for(var i=0;i < nodes.length;i++){
			var srcObjectLight=new printPages2Pdf._srcObjectLight(nodes[i].uri,bTextOnly);
			srcObjectLight.Title=nodes[i].title;
			try {
				var desc = PlacesUIUtils.getItemDescription(nodes[i].itemId);
				if (desc) 
					srcObjectLight.Description = desc;
			}catch(e){}
			srcObjectLight.sourceType="bookmark";
			if(nodes[i].icon){
				if(nodes[i].icon instanceof Components.interfaces.nsIURI)
					srcObjectLight.favIconUrl=nodes[i].icon.spec;
				else
					srcObjectLight.favIconUrl=nodes[i].icon;
			}			
			urlLst.push(srcObjectLight);
		}

		var pars={};
		if(bTextOnly) pars.g_textOnly = bTextOnly; 

		RRprintPages2Pdf.startConversionDlg(urlLst,pars,window);
		
	},	
	
	onMouseUp: function(event, bRecurseAll, bTextOnly){
		var selNode=document.popupNode;
		if(selNode.nodeName == "key")
			selNode=selNode.getUserData("popupNode");

		if(!event.button) event.button=0; //if selected by Return key
		switch(event.button){
			case 0:
			case 2:
				this.printSelection(selNode,false, bTextOnly);
				break;
				
			case 1:
				document.getElementById("placesContext").hidePopup();
				this.printSelection(selNode,true, bTextOnly);
				break;
				
		}

	},
	
	handleKeyboardShortcut:function(event){
		var men=document.getElementById('printPages2Pdf_placesOverlay');
		var tree=document.getElementById("bookmarks-view");
		
		
		if(!tree)
			tree=document.getElementById("placeContent");
		
		
		var treechildren=tree.getElementsByTagName("treechildren")[0];
		var view = PlacesUIUtils.getViewForNode(treechildren);

		
		var	x=window.innerWidth / 2;
		var	y=window.innerHeight / 2;

		event.currentTarget.setUserData("popupNode",view,null);

		men.openPopup(null,null,x,y,false,false,event);
		
	},
	
};

window.addEventListener("load",function(){
	if (RRprintPages2Pdf.prefs.getBoolPref("ui.showplacesmenus") === false)
	{
		["printPages2Pdf_placesOverlay", 
		"printPages2Pdf_printLink"].forEach(function(id){
			var men=document.getElementById(id);
			if (men) {
				men.setAttribute("hidden", true);
				men.removeAttribute("selectiontype");
				men.removeAttribute("selection");
			}
		});
	}
	
	var keyset=document.getElementById("printPages2Pdf_placesOverlayKey").parentNode;
	RRprintPages2Pdf.updateShortcut(keyset,"menmain","printPages2Pdf_placesOverlayKey",{
		oncommand:"printPages2Pdf.bookmarks.handleKeyboardShortcut(event);",
		});
	
},
false);	
	