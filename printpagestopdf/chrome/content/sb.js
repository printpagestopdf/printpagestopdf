Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
//Components.utils.import("resource://printPages2PdfMod/html2Pdf.jsm"); 



/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);



printPages2Pdf.sbOverlay = {  

	template : "",
	folderPath : [],

	exec : function(aRes, aRecursive, bTextOnly)
	{
		if ( ("sbTreeHandler" in window) && ("flattenResources" in sbDataSource) )
		{
			return this.execSbPlus(aRes, aRecursive, bTextOnly);
		}
		else if("ScrapBookData" in window)
		{
			return this.execSb15(aRes, aRecursive, bTextOnly);
		}
		else
			return alert(RRprintPages2Pdf.strb.GetStringFromName("scrapbook.installation.notfound"));
	},

	execSb15 : function(aRes, aRecursive, bTextOnly)
	{

		if (!aRes)
			aRes = sbTreeUI.resource;
		if (!aRes)
			return;
		var id = ScrapBookData.getProperty(aRes, "id");

		this.folderPath = [];
		var tmpRes = aRes;
		var resLst=[];
		if ( ScrapBookData.isContainer(aRes) )
			resLst = ScrapBookData.flattenResources(aRes, 2, aRecursive);
		else
			resLst.push(aRes);
		
		var txt="";
		
		var inUrls=[];
		for(var i=0; i < resLst.length;i++){		
			var type=ScrapBookData.getProperty(resLst[i],"type");
			if(type && (type != "site" && type != "note")) continue; //ignore non URL resources
			var location=ScrapBookData.getURL(resLst[i]);
			var srcObjectLight=new printPages2Pdf._srcObjectLight(location,bTextOnly);
			srcObjectLight.sourceType="scrapbook";
			srcObjectLight.Title=ScrapBookData.getProperty(resLst[i], "title");
			var desc=ScrapBookData.getProperty(resLst[i], "comment");
			if(desc) srcObjectLight.Description=desc;
			var originUrl=ScrapBookData.getProperty(resLst[i], "source");
			if(originUrl) srcObjectLight.originUrl=originUrl;
			var iconUrl=ScrapBookData.getProperty(resLst[i], "icon");
			if(iconUrl) srcObjectLight.favIconUrl=iconUrl;
			inUrls.push(srcObjectLight);
		
		}
		
		var pars={};
		if(bTextOnly) pars.g_textOnly = bTextOnly; 

		RRprintPages2Pdf.startConversionDlg(inUrls,pars,window);
		
	},
		

	execSbPlus : function(aRes, aRecursive, bTextOnly)
	{

		if ( !aRes ) aRes = sbController.isTreeContext ? sbTreeHandler.resource : sbListHandler.resource;
		this.folderPath = [];
		var tmpRes = aRes;
		var resLst=[];
		if ( sbDataSource.isContainer(aRes) )
			this.processFolderRecursively(aRes, aRecursive,resLst);
		else
			resLst.push(aRes);
		
		var txt="";
		
		var inUrls=[];
		for(var i=0; i < resLst.length;i++){		
			var location=sbCommonUtils.getBaseHref(sbDataSource.data.URI) + "data/" + sbDataSource.getProperty(resLst[i], "id") + "/index.html";
		
			var srcObjectLight=new printPages2Pdf._srcObjectLight(location,bTextOnly);
			srcObjectLight.sourceType="scrapbook";
			srcObjectLight.Title=sbDataSource.getProperty(resLst[i], "title");
			var desc=sbDataSource.getProperty(resLst[i], "comment");
			if(desc) srcObjectLight.Description=desc;
			var originUrl=sbDataSource.getProperty(resLst[i], "source");
			if(originUrl) srcObjectLight.originUrl=originUrl;
			var iconUrl=sbDataSource.getProperty(resLst[i], "icon");
			if(iconUrl) srcObjectLight.favIconUrl=iconUrl;
			inUrls.push(srcObjectLight);
		
		}
		
		var pars={};
		if(bTextOnly) pars.g_textOnly = bTextOnly; 

		RRprintPages2Pdf.startConversionDlg(inUrls,pars,window);
		
	},

	processFolderRecursively : function(aRes, aRecursive,resLst)
	{
		var txt = "";
		//if ( aRes.Value != "urn:scrapbook:root" ) this.folderPath.push(sbDataSource.getProperty(aRes, "title"));
		sbCommonUtils.RDFC.Init(sbDataSource.data, aRes);
		var resEnum = sbCommonUtils.RDFC.GetElements();
		while ( resEnum.hasMoreElements() )
		{
			var res = resEnum.getNext();
			if ( sbDataSource.isContainer(res) ) {
				if ( aRecursive ) this.processFolderRecursively(res, aRecursive,resLst);
			} else {
					if(!sbDataSource.getProperty(res,"type") || sbDataSource.getProperty(res,"type") == "note")
					resLst.push(res);
			}
		}
		//if ( aRes.Value != "urn:scrapbook:root" ) this.folderPath.pop();
		//return txt;
	},

	getPageInfo : function(aRes)
	{
		var txt = this.template;
		txt = txt.replace(/%ID%/g,      sbDataSource.getProperty(aRes, "id"));
		txt = txt.replace(/%TITLE%/g,   sbDataSource.getProperty(aRes, "title"));
		txt = txt.replace(/%SOURCE%/g,  sbDataSource.getProperty(aRes, "source"));
		txt = txt.replace(/%COMMENT%/g, sbDataSource.getProperty(aRes, "comment"));
		txt = txt.replace(/%DATE%/g,    this.formatID2DateTime(sbDataSource.getProperty(aRes, "id")));
		txt = txt.replace(/%LOCAL%/g,   sbCommonUtils.getBaseHref(sbDataSource.data.URI) + "data/" + sbDataSource.getProperty(aRes, "id") + "/index.html");
		//txt = txt.replace(/%FOLDER%/g,  this.folderPath.join("/"));
		txt = sbDataSource.getProperty(aRes, "source");
		
		return txt;
	},

	formatID2DateTime : function(aID)
	{
		aID.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
		try {
			const SDF = Components.classes['@mozilla.org/intl/scriptabledateformat;1'].getService(Components.interfaces.nsIScriptableDateFormat);
			return SDF.FormatDateTime("", SDF.dateFormatLong, SDF.timeFormatSeconds, RegExp.$1, RegExp.$2, RegExp.$3, RegExp.$4, RegExp.$5, RegExp.$6);
		} catch(ex) {
			return [RegExp.$1, RegExp.$2, RegExp.$3].join("/") + " " + [RegExp.$4, RegExp.$5, RegExp.$6].join(":");
		}
	},

	handleKeyboardShortcut:function(event){
		var men=document.getElementById('printPages2_PdfTreePopup');
		var tree=document.getElementById("sbTree");
		if(!men || !tree || tree.view.selection.count <= 0) return;

		
		var	x=window.innerWidth / 2;
		var	y=window.innerHeight / 2;

		men.openPopup(null,null,x,y,false,false,event);
		
	},

	
};  
	
		
window.addEventListener("load",function(){
	if ((!(("sbTreeHandler" in window) && ("flattenResources" in sbDataSource)) && 
			!("ScrapBookData" in window)) ||
			RRprintPages2Pdf.prefs.getBoolPref("ui.showsbmenus") === false)
	{
		["printPages2_PdfTreePopup", 
		"printPages2Pdf_sbPopup", 
		"printPages2pdf_sbAddOnsPopup"].forEach(function(id){
			var men=document.getElementById(id);
			if(men) men.setAttribute("hidden",true);
		});
	}
	
	var keyset=document.createElement("keyset");
	document.documentElement.appendChild(keyset);
	RRprintPages2Pdf.updateShortcut(keyset,"menmain","printPages2Pdf_mainMenuKey",{
		oncommand:"printPages2Pdf.sbOverlay.handleKeyboardShortcut(event);",
		});
	
},
false);	
	
	  
	
