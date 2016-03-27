Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);
	
printPages2Pdf.UI = {
	_dialogWin:null,
	
	onPopupShowing:function(parent){
		var frMen=document.getElementById("printPages2Pdf_printFrame");
		if(gContextMenu.inFrame){
			frMen.hidden=false;
			frMen.addEventListener("command",function(){
				printPages2Pdf.UI.printFrame(document.popupNode.ownerDocument.defaultView);
			},
			false
			);
		}
		else
			frMen.hidden=true;

		var lnkMen=document.getElementById("printPages2Pdf_printDocLink");
		if(gContextMenu.onLink && !gContextMenu.onMailtoLink){
			lnkMen.hidden=false;
			lnkMen.addEventListener("command",function(){
				printPages2Pdf.UI.printLink(document.popupNode);
			},
			false
			);
		}
		else
			lnkMen.hidden=true;

		RRprintPages2Pdf.normalizeMenuSeparators(parent);
	},
	
	onToolbarButton:function(evt){
		switch (RRprintPages2Pdf.prefs.getCharPref("ui.tbbfunction")) {
			case "activetab":
				this.printActiveTab({
					g_textOnly: false,
				});
				break;
			case "alltabs":
				this.printAllTabs({
					g_textOnly: false,
				});
				break;
			default:
				break;
		}
	},


	printSelectedTabs : function(pars){

		if(! MultipleTabService) return;
		
		var tabs=MultipleTabService.getSelectedTabs();
		
		if(tabs.length === 0 ) return;
		
		var convWins=new Array();
		
		for (var i = 0; i < tabs.length; i++) {
			var srcObjectLight = new printPages2Pdf._srcObjectLight(gBrowser.getBrowserForTab(tabs[i]).contentWindow, pars.g_textOnly);
			var title = gBrowser.getBrowserForTab(tabs[i]).contentTitle;
			if(title)
				srcObjectLight.Title = title;
			
			srcObjectLight.sourceType="browsertab";
			convWins.push(srcObjectLight);
		}
			
		
		RRprintPages2Pdf.startConversionDlg(convWins,pars,window);
				
	},

	
	printAllTabs : function(pars){

		if(gBrowser.browsers.length == 0) return;

		
		var convWins=new Array();
		
		for (var i = 0; i < gBrowser.browsers.length; i++) {
			//convWins.push(gBrowser.browsers[i].contentWindow);
			
			var srcObjectLight = new printPages2Pdf._srcObjectLight(gBrowser.browsers[i].contentWindow, pars.g_textOnly);
			var title = gBrowser.browsers[i].contentTitle;
			if(title)
				srcObjectLight.Title = title;
			
			srcObjectLight.sourceType="browsertab";
			convWins.push(srcObjectLight);
		}
			
		
		RRprintPages2Pdf.startConversionDlg(convWins,pars,window);
				
	},
	
	handleKeyboardShortcut:function(event){
	
		var menu=document.getElementById('printPages2Pdf_extraMenuPopup');

		var x=0; var y=0;

		if(gBrowser.selectedBrowser){
			x=gBrowser.selectedBrowser.contentWindow.outerWidth / 2;
			y=gBrowser.selectedBrowser.contentWindow.outerHeight / 2;
		}
		else
		{
			x=window.outerWidth / 2;
			y=window.outerHeight / 2;
		}
		menu.openPopup(null,null,x,y,true,true);
	},

	openProcessDialog:function(event){
		RRprintPages2Pdf.startConversionDlg([],{},window);		
	},
	
	openPreferences: function(event){
		var features = "chrome,titlebar,toolbar,centerscreen,modal";
		window.openDialog("chrome://printPages2Pdf/content/prefs.xul", "Preferences", features);
		
	},
	
	printLink:function(el){
		var srcObjectLight = new printPages2Pdf._srcObjectLight(el.toString(), false);
		

		srcObjectLight.sourceType="unknown";

		RRprintPages2Pdf.startConversionDlg([srcObjectLight],{g_textOnly:false,},window);
	},

	printFrame:function(frmWindow){
		var srcObjectLight = new printPages2Pdf._srcObjectLight(frmWindow, false);
		

		var title = frmWindow.document.title;
		if(title)
			srcObjectLight.Title = title;

	
		srcObjectLight.sourceType="frame";

		RRprintPages2Pdf.startConversionDlg([srcObjectLight],{g_textOnly:false,},window);
		this._frame=null;
	},
	
	printThisTab:function(pars,tab){
		if (!tab) return;
		
		var srcObjectLight = new printPages2Pdf._srcObjectLight(gBrowser.getBrowserForTab(tab).contentWindow, pars.g_textOnly);
		var title = gBrowser.getBrowserForTab(tab).contentTitle;
		if(title)
			srcObjectLight.Title = title;
		
		srcObjectLight.sourceType="browsertab";

		
		RRprintPages2Pdf.startConversionDlg([srcObjectLight],pars,window);
	},


	toggleSidebar : function(pars){
		
		var sidebarWindow = document.getElementById("sidebar").contentWindow;
		//sidebarWindow.location.href = "chrome://printPages2Pdf/content/sbArchive.xul";
		toggleSidebar(pars);		
		
	},
	
	printSelection : function(evt){
		
		Components.utils.import("resource://printPages2PdfMod/editBrowserPage.jsm",printPages2Pdf);
		gBrowser.selectedBrowser.contentWindow.ed=new  printPages2Pdf._editBrowserPage(gBrowser.selectedBrowser.contentWindow);
		gBrowser.selectedBrowser.contentWindow.ed.mainWindow=window;
		gBrowser.selectedBrowser.contentWindow.ed.onload();

	},
	
	printActiveTab : function(pars){

		if(gBrowser.browsers.length == 0 || gBrowser.selectedTab == null) return;

		
		
		var srcObjectLight = new printPages2Pdf._srcObjectLight(gBrowser.selectedBrowser.contentWindow, pars.g_textOnly);
		var title = gBrowser.selectedBrowser.contentTitle;
		if(title)
			srcObjectLight.Title = title;
		
		srcObjectLight.sourceType="browsertab";

		
		RRprintPages2Pdf.startConversionDlg([srcObjectLight],pars,window);
				
	},
	
	updateShowTbbMenus:function(menItem,bValue)
	{
		var ndMen=document.getElementById("printPages2Pdf-" + menItem);
		if (ndMen) {
			ndMen.hidden = !bValue;			
			RRprintPages2Pdf.normalizeMenuSeparators(ndMen.parentNode);
		}		
	},

	initShowTbbMenus:function()
	{
		var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]  
		     .getService(Components.interfaces.nsIPrefService)  
		     .getBranch("extensions.RRprintPages2Pdf.ui.showtbbmenus.");
		
		var cnt={};	 
		var arPrefs = prefBranch.getChildList("",cnt)
		
		for(var i=0; i < cnt.value;i++)
		{
			this.updateShowPageMenus("ui.showtbbmenus." + arPrefs[i],prefBranch.getBoolPref(arPrefs[i]));
			
		}
	},
	

	updateShowExtraMenus:function(menItem,bValue)
	{
		var ndMen=document.getElementById("printPages2Pdf-" + menItem);
		if (ndMen) {
			ndMen.hidden = !bValue;			
			RRprintPages2Pdf.normalizeMenuSeparators(ndMen.parentNode);
		}		
	},

	initShowExtraMenus:function()
	{
		var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]  
		     .getService(Components.interfaces.nsIPrefService)  
		     .getBranch("extensions.RRprintPages2Pdf.ui.showextramenus.");
		
		var cnt={};	 
		var arPrefs = prefBranch.getChildList("",cnt)
		
		for(var i=0; i < cnt.value;i++)
		{
			this.updateShowPageMenus("ui.showextramenus." + arPrefs[i],prefBranch.getBoolPref(arPrefs[i]));
			
		}
	},
	
	updateShowPageMenus:function(menItem,bValue)
	{
		var ndMen=document.getElementById("printPages2Pdf-" + menItem);
		if(ndMen)
			ndMen.hidden=! bValue;
	},
	
	initShowPageMenus:function()
	{
		var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]  
		     .getService(Components.interfaces.nsIPrefService)  
		     .getBranch("extensions.RRprintPages2Pdf.ui.showpagemenus.");
		
		var cnt={};	 
		var arPrefs = prefBranch.getChildList("",cnt)
		
		for(var i=0; i < cnt.value;i++)
		{
			this.updateShowPageMenus("ui.showpagemenus." + arPrefs[i],prefBranch.getBoolPref(arPrefs[i]));
			
		}
	},
	
	onTest : function(event){
		var tabs=MultipleTabService.getSelectedTabs();
		
		alert(tabs);
		
	}	
}



window.addEventListener("load",function(){
	
	printPages2Pdf.UI.initShowPageMenus();
	RRprintPages2Pdf.gPrefObserver.showPageMenusCallback = printPages2Pdf.UI.updateShowPageMenus;
	
	printPages2Pdf.UI.initShowExtraMenus();
	RRprintPages2Pdf.gPrefObserver.showExtraMenusCallback = printPages2Pdf.UI.updateShowExtraMenus;

	printPages2Pdf.UI.initShowTbbMenus();
	RRprintPages2Pdf.gPrefObserver.showTbbMenusCallback = printPages2Pdf.UI.updateShowTbbMenus;
	
	
	
	if (RRprintPages2Pdf.prefs.getBoolPref("ui.showpagemenus") === false)
	{
		var cmd=document.getElementById("printPages2Pdf_showpagemenu");
		if(cmd) cmd.setAttribute("hidden",true);
	}

	if (RRprintPages2Pdf.prefs.getBoolPref("ui.showextramenus") === false)
	{
		var cmd=document.getElementById("printPages2Pdf_showextramenu");
		if(cmd) cmd.setAttribute("hidden",true);
	}

	if (RRprintPages2Pdf.prefs.getBoolPref("ui.showtabmenu") === false)
	{
		var cmd=document.getElementById("printPages2Pdf-men_printThisTab");
		if(cmd) cmd.setAttribute("hidden",true);
	}
	

	var keyset=document.getElementById("mainKeyset");
	if (keyset) {
		RRprintPages2Pdf.updateShortcut(keyset,"menmain","printPages2Pdf_mainMenuKey",{
			oncommand:"printPages2Pdf.UI.handleKeyboardShortcut(event);",
			});

		
		RRprintPages2Pdf.updateShortcut(keyset,"sidebar","printPages2Pdf_sidebarKey",{
			observes:"printPages2Pdf-bc_sidebar",
			});

		RRprintPages2Pdf.updateShortcut(keyset,"prpage","printPages2Pdf_prpageKey",{
			oncommand:"printPages2Pdf.UI.printActiveTab({g_textOnly:false});",
			});

		RRprintPages2Pdf.updateShortcut(keyset,"prtabs","printPages2Pdf_prtabsKey",{
			oncommand:"printPages2Pdf.UI.printAllTabs({g_textOnly:false});",
			});
	}
	
},
false);	
