Components.utils.import('resource://gre/modules/Services.jsm');
var EXPORTED_SYMBOLS = ["RRprintPages2Pdf",];

/** 
 * RRprintPages2Pdf namespace. 
 */  
if (typeof RRprintPages2Pdf == "undefined") {  
  var RRprintPages2Pdf = {};  
};




RRprintPages2Pdf = {
	mainDlg:null,
	SUCCESS : 0x01,
	ERROR : 0x02,
	RUNNING : 0x04,
	TIMEOUT : 8,
	isStatus:function(status,test){
		return ( (status & test) === test);
	},
	clearStatus:function(status,mask){
		return (status &= ~mask);
	},

	nsTransferable : Components.Constructor("@mozilla.org/widget/transferable;1", "nsITransferable"),
	nsSupportsString : Components.Constructor("@mozilla.org/supports-string;1", "nsISupportsString"),
	stopPersist : false,
	stopDomloader : false,
	stopProcessing : false,

	persistLoops : 0,
	domloaderLoops : 0,
		
	_ExtensionDir : null,
	_UserSessionTempDir:null,
	_UserTempDir : null,
	_UserAppTempDir : null,
	_DocumentsDir : null,
	_HomeDir:null,
	observerService:	this.observerService=Components.classes["@mozilla.org/observer-service;1"]
	      .getService(Components.interfaces.nsIObserverService),
	
	_setWellKnownDirs:function() {
			var dirService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
			
			
			var myExtensionDir = null;
			var extensionDirs = dirService.get("XREExtDL", Components.interfaces.nsISimpleEnumerator);
			while (extensionDirs.hasMoreElements()) {
				var extensionDir = extensionDirs.getNext().QueryInterface(Components.interfaces.nsIFile);
				if (extensionDir.leafName == this.g_const.EXTENSION_NAME) 
					myExtensionDir = extensionDir
			}
			
			this._ProfileDir = dirService.get("ProfD", Components.interfaces.nsIFile);
			if (myExtensionDir == null) {
				myExtensionDir = this._ProfileDir.clone();
				myExtensionDir.append(this.g_const.EXTENSION_SUBDIR);
				myExtensionDir.append(this.g_const.EXTENSION_NAME);
			}
						
			this._ExtensionDir =  myExtensionDir;
//			this._UserTempDir = dirService.get("ProfLD", Components.interfaces.nsILocalFile);
			this._UserTempDir = dirService.get("TmpD", Components.interfaces.nsILocalFile);
			var profileName=dirService.get("ProfLD", Components.interfaces.nsILocalFile).leafName;
			this._UserTempDir.append(profileName);
			if(!this._UserTempDir.exists())
				this._UserTempDir.create(this._UserTempDir.DIRECTORY_TYPE,0777);

			this._HomeDir = dirService.get("Home", Components.interfaces.nsILocalFile);
			
			if(this.osString == "WINNT")
				this._DocumentsDir = dirService.get("Pers", Components.interfaces.nsILocalFile);
			else
				this._DocumentsDir = dirService.get("Home", Components.interfaces.nsILocalFile);
			
	},

	_xulAppInfo:null,
	get xulAppInfo(){
		if(!this._xulAppInfo)
			this._xulAppInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                 						.getService(Components.interfaces.nsIXULAppInfo);	
		return this._xulAppInfo;		
	},
	
	_versionChecker:null,
	get versionChecker(){
		if(!this._versionChecker)
			this._versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]  
                              			 .getService(Components.interfaces.nsIVersionComparator);  
		return this._versionChecker;
	},
	
	 _ProfileDir:null,
	 get ProfileDir(){
	 	if (this._ProfileDir == null) 
			this._setWellKnownDirs();		
		
		return this._ProfileDir;
	},

	get HomeDir(){
	 	if (this._ExtensionDir == null) 
			this._setWellKnownDirs();		
		
		return this._HomeDir;		
	},
		
	 get ExtensionDir(){
	 	if (this._ExtensionDir == null) 
			this._setWellKnownDirs();		
		
		return this._ExtensionDir;
	},
	
	_pdfJsEnabled : null,
	get pdfJsEnabled(){
		if (this._pdfJsEnabled == null){
			this._pdfJsEnabled=false;
			var prefPdfJs = Components.classes["@mozilla.org/preferences-service;1"]  
     				.getService(Components.interfaces.nsIPrefService).getBranch("pdfjs.");
			
			if(prefPdfJs != null){
				var type=prefPdfJs.getPrefType("disabled")
				if(type == prefPdfJs.PREF_BOOL)
					this._pdfJsEnabled=!prefPdfJs.getBoolPref("disabled");
			}
						
		}
		
		return this._pdfJsEnabled;
	},
	
	get DocumentsDir(){
	 	if (this._DocumentsDir == null) 
			this._setWellKnownDirs();		
		
		return 	this._DocumentsDir;	
	},
	
	get UserTempDir() {
	 	if (this._UserTempDir == null) 
			this._setWellKnownDirs();		
		
		return 	this._UserTempDir;	
	},

	get UserSessionTempDir(){
		if(this._UserSessionTempDir == null){
			this._UserSessionTempDir=this.UserAppTempDir.clone();
			this._UserSessionTempDir.append("tmp");
				
		}	

		if (!this._UserSessionTempDir.exists())
			this._UserSessionTempDir.create(this._UserSessionTempDir.DIRECTORY_TYPE,0777);

		
		return 	this._UserSessionTempDir;
	},
	
	get RecentDir() {
		var recentDir = this.UserAppTempDir.clone();
		
		recentDir.append("recent");
		
		if(!recentDir.exists())
		{
			recentDir.create(recentDir.DIRECTORY_TYPE,0777);			
		}
		
		return recentDir;
		
	},
	
	get UserAppTempDir() {
		if(this._UserAppTempDir == null){
			this._UserAppTempDir=this.UserTempDir.clone();
			this._UserAppTempDir.append("printPages2Pdf");
		}	
		if (!this._UserAppTempDir.exists())
			this._UserAppTempDir.create(this._UserAppTempDir.DIRECTORY_TYPE,0777);
		
		return 	this._UserAppTempDir;
	},
	SupportsString :function(str) {
	    // Create an instance of the supports-string class
	    var res = this.nsSupportsString();
	 
	    // Store the JavaScript string that we want to wrap in the new nsISupportsString object
	    res.data = str;
	    return res;
	},
	
	Transferable : function(source) {
	    var res = this.nsTransferable();
	    if ('init' in res) {
	        // When passed a Window object, find a suitable provacy context for it.
	        if (source instanceof Components.interfaces.nsIDOMWindow)
	            // Note: in Gecko versions >16, you can import the PrivateBrowsingUtils.jsm module
	            // and use PrivateBrowsingUtils.privacyContextFromWindow(sourceWindow) instead
	            source = source.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
	                           .getInterface(Components.interfaces.nsIWebNavigation);
	 
	        res.init(source);
	    }

	    return res;
	},

	openFileOsDefault:function(file){
		var retVal=true;
		switch(this.osString){
			case "Linux":
				var executable = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				try {
					executable.initWithPath("/usr/bin/xdg-open");
					if(executable.exists() && executable.isFile() && executable.isExecutable()){
						var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
						process.init(executable);
						//var args = [file.path,];
						
						//make the toc path to a file url = no problems with unicode
						var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
						var args = [IO.newFileURI(file).spec,];
						
						process.run(false,args, 1);
					}
					else {
						retVal=false;
					}
				}catch(e){
					retVal=false;
				}
				break;
			case "WINNT":
			default:
				file.QueryInterface(Components.interfaces.nsILocalFile).launch();			
				break;
			
		}
		
		return retVal;
	},


		
	createUserTempFile : function(suggestedName){
		if(! suggestedName) suggestedName="dummy";
		
		var retVal=this.UserAppTempDir.clone();
		try {
			retVal.append(suggestedName);
			retVal.createUnique(retVal.NORMAL_FILE_TYPE,0666);
			
		} catch(e) {return null;}
		
		return retVal;		
		
		
	},
	
	_is64bit:null,
	get is64bit(){
		if (this._is64bit == null) {
			var xpcomAbi = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).XPCOMABI;
			this._is64bit=(xpcomAbi.search(/x86_64/) > -1);
		}  
		return this._is64bit;
	},
	
	
	_osString:null,
	get osString(){
		if(! this._osString)
			this._osString=Components.classes["@mozilla.org/xre/app-info;1"]  
               				.getService(Components.interfaces.nsIXULRuntime).OS;  
		return this._osString;
	},
	
	_pathSep:null,
	get pathSep(){
		if(! this._pathSep){
			if(this.osString == "WINNT")
				this._pathSep = "\\";
			else
				this._pathSep="/";				
		}
		
		return this._pathSep;
		
	},

	WriteTextFile:function (File, Text)
    {
        if (!File) return;
        const unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

        unicodeConverter.charset = "UTF-8";

        Text = unicodeConverter.ConvertFromUnicode(Text);
        const os = Components.classes["@mozilla.org/network/file-output-stream;1"]
          .createInstance(Components.interfaces.nsIFileOutputStream);
        os.init(File, 0x02 | 0x08 | 0x20, 0700, 0);
        os.write(Text, Text.length);
        os.close();
    },
	
	replaceFileExt : function(objFile,ext){
		if ("leafName" in objFile) {
			objFile.leafName = objFile.leafName.replace(/\.[^\.]*$/g, "." + ext);
			return objFile.leafName;
		}
		else {
			objFile = objFile.replace(/\.[^\.]*$/g, "." + ext);
			return objFile;
		}		
		
	},
	
	getThumbFile : function(pdfFile,ext){

		
		if(pdfFile.leafName.search(/\.pdf$/i) == -1 ) return null;
		
		var thumbFile=pdfFile.clone();
		this.replaceFileExt(thumbFile,ext);
		thumbFile.leafName = "." + thumbFile.leafName;
		return thumbFile;
	},
	
	ReadTextFile:function (File)
    {
        if (!File) return;
        var res;
		var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
		                          .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		converter.charset = /* The character encoding you want, using UTF-8 here */ "UTF-8";

        const is = Components.classes["@mozilla.org/network/file-input-stream;1"]
            .createInstance(Components.interfaces.nsIFileInputStream);
        const sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
            .createInstance(Components.interfaces.nsIScriptableInputStream);
        is.init(File, 0x01, 0400, null);
        sis.init(is);

        res = sis.read(sis.available());

        is.close();

        return  converter.ConvertToUnicode(res);
    },

	
	_validateFileNameRegExp : function(aFileName)
	{
		aFileName = aFileName.replace(/[\"\?!~`]+/g, "");
		aFileName = aFileName.replace(/[\*\&]+/g, "+");
		aFileName = aFileName.replace(/[\\\/\|\:;]+/g, "-");
		aFileName = aFileName.replace(/[\<]+/g, "(");
		aFileName = aFileName.replace(/[\>]+/g, ")");
		aFileName = aFileName.replace(/[\s]+/g, "_");
		aFileName = aFileName.replace(/[%]+/g, "@");

		aFileName = aFileName.replace(/[,;]/g, "");
		
		return aFileName;
	},
		
	validateFileName : function(aFileName, aBaseDir)
	{
					
		switch (this.osString) {
			case "WINNT":
				try {
					Components.utils.import("resource://gre/modules/ctypes.jsm");
					var lib = ctypes.open("shell32.dll");
					
					var PathCleanupSpec = lib.declare("PathCleanupSpec", ctypes.winapi_abi, ctypes.int32_t, ctypes.jschar.ptr, ctypes.jschar.ptr);
					
					var jsBaseDir="";
					var toClean = ctypes.jschar.array(2048)(aFileName);
					if (!aBaseDir) 
						aBaseDir = "";


					var ret = PathCleanupSpec(aBaseDir, toClean);
					lib.close();

					if (ret < 8) 
						aFileName = toClean.readString();
					else 
						aFileName = this._validateFileNameRegExp(aFileName);
				} catch(e){
						aFileName = this._validateFileNameRegExp(aFileName);
				}
				break;
				
			case "Linux":
			default:
				aFileName = this._validateFileNameRegExp(aFileName);
				aFileName = aFileName.replace(/\//g, "_");
				break;
				
		}


		return aFileName;
	},	
	
	_ScrapBookDir:null,
	getScrapBookDir : function()
	{
		if (!this._ScrapBookDir) {
		
			var PREF = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
			try {
				var isDefault = PREF.getBoolPref("scrapbook.data.default");
				var strDir = PREF.getComplexValue("scrapbook.data.path", Components.interfaces.nsIPrefLocalizedString).data;
				
				this._ScrapBookDir = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
				this._ScrapBookDir.initWithPath(strDir);
				
			} 
			catch (ex) {
				isDefault = true;
			}
			if (isDefault) {
				this._ScrapBookDir = this.ProfileDir.clone();
				this._ScrapBookDir.append("ScrapBook");
			}
			
			if (!this._ScrapBookDir.exists()) 
				this._ScrapBookDir = null;
		}

		return this._ScrapBookDir;
	},
	
	processSbFolderRecursively : function(RDF,RDFCU,ds,aRes, aRecursive,resLst)
	{
		var txt = "";
		//if ( aRes.Value != "urn:scrapbook:root" ) this.folderPath.push(sbDataSource.getProperty(aRes, "title"));
		var RDFC=Components.classes['@mozilla.org/rdf/container;1'].getService(Components.interfaces.nsIRDFContainer); 
		
		RDFC.Init(ds, aRes);
		var resEnum = RDFC.GetElements();
		while ( resEnum.hasMoreElements() )
		{
			var res = resEnum.getNext();
			if(RDFCU.IsContainer(ds, res)) {
				if ( aRecursive ) this.processSbFolderRecursively(RDF,RDFCU,ds,res, aRecursive,resLst);
			} else {
				resLst.push(this.getSbProps(RDF,ds,res));
			}
		}
		//if ( aRes.Value != "urn:scrapbook:root" ) this.folderPath.pop();
		//return txt;
	},
	
	updateShortcut:function(keyset,prefBase,keyId,attributes){
		if (!keyset || !keyset.ownerDocument) return;
		var doc=keyset.ownerDocument;
		var key = this.prefs.getCharPref("sc." + prefBase + "_key");
		if (!key) return;
		
		var newKey = doc.getElementById(keyId);
		if (!newKey) {
			newKey = doc.createElement("key");
			keyset.appendChild(newKey);
		}
		
		newKey.setAttribute("id", keyId);
		newKey.setAttribute("key", key);
		
		var mod="";
		if(this.prefs.getBoolPref("sc." + prefBase + "_ctrl") === true)
			mod += "control ";
		if(this.prefs.getBoolPref("sc." + prefBase + "_alt") === true)
			mod += "alt ";
		if(this.prefs.getBoolPref("sc." + prefBase + "_shift") === true)
			mod += "shift ";
		if(mod)
			newKey.setAttribute("modifiers", mod);
		
		for(var name in attributes)
			newKey.setAttribute(name, attributes[name]);

	},
	
	getBaseHref : function(sURI)
	{
		var pos, base;
		base = ( (pos = sURI.indexOf("?")) != -1 ) ? sURI.substring(0, pos) : sURI;
		base = ( (pos = base.indexOf("#")) != -1 ) ? base.substring(0, pos) : base;
		base = ( (pos = base.lastIndexOf("/")) != -1 ) ? base.substring(0, ++pos) : base;
		return base;
	},
		
	getSbProps:function(RDF,ds,res){
		var retVal={};
		var prop = ds.GetTarget(res, RDF.GetResource("http://amb.vis.ne.jp/mozilla/scrapbook-rdf#" + "title"), true);
		retVal.title= prop.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

		prop = ds.GetTarget(res, RDF.GetResource("http://amb.vis.ne.jp/mozilla/scrapbook-rdf#" + "source"), true);
		retVal.source= prop.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
		
		prop = ds.GetTarget(res, RDF.GetResource("http://amb.vis.ne.jp/mozilla/scrapbook-rdf#" + "comment"), true);
		retVal.comment= prop.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

		prop = ds.GetTarget(res, RDF.GetResource("http://amb.vis.ne.jp/mozilla/scrapbook-rdf#" + "icon"), true);
		retVal.favIconUrl= prop.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

		
		prop = ds.GetTarget(res, RDF.GetResource("http://amb.vis.ne.jp/mozilla/scrapbook-rdf#" + "id"), true);
		retVal.id= prop.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
		
		retVal.location=this.getBaseHref(ds.URI) + "data/" + retVal.id + "/index.html";
		
		return retVal;
	},
		
	getSbRdfObject : function(strNode,aRecursive)
	{
		var retAr=null;
		try {
			var file = this.getScrapBookDir().clone();
			if(!file) return null;
			file.append("scrapbook.rdf");
			if ( !file.exists() ) return null;
			
			var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
			var fileURL = IO.newFileURI(file).spec;
			var RDF=Components.classes['@mozilla.org/rdf/rdf-service;1'].getService(Components.interfaces.nsIRDFService);
			var RDFCU=Components.classes['@mozilla.org/rdf/container-utils;1'].getService(Components.interfaces.nsIRDFContainerUtils);
			
			
			var ds = RDF.GetDataSourceBlocking(fileURL);
			var res   = RDF.GetResource(strNode);
			retAr=[];
			
			if(RDFCU.IsContainer(ds, res)) 
				this.processSbFolderRecursively(RDF,RDFCU,ds,res,aRecursive,retAr);
			else
				retAr.push(this.getSbProps(RDF,ds,res));			
			
		}
		catch(ex) {
			retAr=null;
		}
		
		return retAr;
	},
	
	getHelpUrl : function(section)
	{
		var req=null;
		var urlList=RRprintPages2Pdf.prefs.getCharPref("ui.helpsite");
		var arUrl=urlList.split(";");
		var baseUrl=null;
		
		for (var i = 0; i < arUrl.length; i++) {
			try {
				req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
				req.timeout = 2000;
				req.open('POST',arUrl[i] + "/sitetest/sitetest.html", false);
				req.send('');
			} 
			catch (e) {	}
			
			if(req.responseText == "OK")
			{
				baseUrl=arUrl[i];
				break;		
			}
		}
		
		if(!baseUrl) return null;
		
		if(section)
			return (baseUrl + "/index.php/" + section + ".html");
		else
			return (baseUrl + "/index.php");
			
	},
	
	showHelp: function(section){
		
		var helpUrl=null;
		if(section)
			helpUrl=this.getHelpUrl(section);
		else
			helpUrl=this.getHelpUrl();
		
		if(helpUrl)
			this.openInBrowser(helpUrl);
			
	},
	
	
	confirmDlg : function(win,title,text){
		var prompt=Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
		return prompt.confirm(win,title,text);		
	},
	
	openInBrowser: function(url){
		var ret=null;
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
		                   .getService(Components.interfaces.nsIWindowMediator);  
		var mainWindow = wm.getMostRecentWindow("navigator:browser"); 
		if (mainWindow) {
			ret = mainWindow.gBrowser.addTab(url);
			mainWindow.gBrowser.selectedTab = ret;
		}  	
		
		return ret;
	},
  
  	normalizeMenuSeparators:function(men)
	{
		var count=men.childNodes.length;

		var isSecond=false;
		var first=null;
		var last=null;
		
		for(var i=0;i < count;i++)
		{
			var item=men.childNodes[i];
			if(first == null && !item.hidden) first=item;
			switch(item.tagName)
			{
				case "menuseparator":
					if (isSecond) 
						item.hidden = true;
					else {
						item.hidden = false;
						last=item;
					}
					isSecond=true;
					break;
					
				default:
					if (!item.hidden) {
						isSecond = false;
						last = item;
					}
					break;
			}
		}
		
		if(first && first.tagName == "menuseparator") first.hidden=true;
		if(last && last.tagName == "menuseparator") last.hidden = true;
		
	},
	
	init:function(){
		
	  var tmpObjects=this.UserAppTempDir.directoryEntries;
	  if (tmpObjects.hasMoreElements()) {
	  	var tm = Components.classes["@mozilla.org/thread-manager;1"].getService(Components.interfaces.nsIThreadManager);
	  	
	  	tm.mainThread.dispatch({
	  		run: function(){
				while(tmpObjects.hasMoreElements()){
					try {
						var file = tmpObjects.getNext().QueryInterface(Components.interfaces.nsIFile);
						file.remove(true);
					}catch(e){}
				}
	  		}
	  	}, Components.interfaces.nsIThread.DISPATCH_NORMAL);
	  }
	  
	},
	
}

RRprintPages2Pdf.cs = Components.classes["@mozilla.org/consoleservice;1"]
                     .getService(Components.interfaces.nsIConsoleService);

//Browser Console					 
RRprintPages2Pdf.bcs = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;

RRprintPages2Pdf.Exception = function(source,code,message){
	this.source=source;
	this.message=message;
	this.code=code;
}

RRprintPages2Pdf.gPrefObserver = {
	  tocCallback:null,
	  coverCallback:null,
	  showPageMenusCallback:null,
	  showExtraMenusCallback:null,
	  showTbbMenusCallback:null,
	  unitPrefsNames: [
				  "wkhtml.gopt.size.width",
				  "wkhtml.gopt.size.height",
				  "wkhtml.gopt.margin.top",
				  "wkhtml.gopt.margin.bottom",
				  "wkhtml.gopt.margin.right",
				  "wkhtml.gopt.margin.left",
				  "wkhtml.gopt.toc.indentation",
				  ], 
      register: function() {  
        var prefService = Components.classes["@mozilla.org/preferences-service;1"]  
                                    .getService(Components.interfaces.nsIPrefService);  
      
        this._branch = prefService.getBranch("extensions.RRprintPages2Pdf.");  
      
        this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);  
      
        this._branch.addObserver("", this, false);  
		
	   
	    var observerService = Components.classes["@mozilla.org/observer-service;1"]  
                          .getService(Components.interfaces.nsIObserverService);  
		
//		observerService.addObserver(this, "content-document-global-created", false);  
		observerService.addObserver(this, "browser-lastwindow-close-granted", false);  
		observerService.addObserver(this, "sessionstore-windows-restored", false);  
				
      },  
      
      unregister: function() {  
        if (!this._branch) return;  
        this._branch.removeObserver("", this);  
		
		
	    var observerService = Components.classes["@mozilla.org/observer-service;1"]  
	                            .getService(Components.interfaces.nsIObserverService);  
//	    observerService.removeObserver(this, "content-document-global-created");  
	    observerService.removeObserver(this, "browser-lastwindow-close-granted");  
	    observerService.removeObserver(this, "sessionstore-windows-restored");  
		
      },  
      
      observe: function(aSubject, aTopic, aData) {  
	  	switch (aTopic) {
			case "nsPref:changed":
				try {
					if (/^ui.showpagemenus.*$/.test(aData)) {
						if(this.showPageMenusCallback)
							this.showPageMenusCallback(aData,aSubject.getBoolPref(aData));
						break;
					}
					
					if (/^ui.showextramenus.*$/.test(aData)) {
						if(this.showExtraMenusCallback)
							this.showExtraMenusCallback(aData,aSubject.getBoolPref(aData));
						break;
					}
					
					if (/^ui.showtbbmenus.*$/.test(aData)) {
						if(this.showTbbMenusCallback)
							this.showTbbMenusCallback(aData,aSubject.getBoolPref(aData));
						break;
					}

				}catch(e){break;}
				
				switch (aData) {
					case "wkhtml.iopt.pageunits":
						var strUnit = aSubject.getCharPref(aData);
						for (var i = 0; i < this.unitPrefsNames.length; i++) {
							if (aSubject.prefHasUserValue(this.unitPrefsNames[i])) {
								var oldVal = aSubject.getCharPref(this.unitPrefsNames[i]);
								var newVal = oldVal.replace(/[\D|!,|!\.]*$/, strUnit);
								aSubject.setCharPref(this.unitPrefsNames[i], newVal);
								
							}
						}
						break;
					case "wkhtml.iopt.isTableOfContent":
						try {
							if (this.tocCallback) {
								this.tocCallback();
							}
						} 
						catch (e) {
						}
						break;
					case "wkhtml.iopt.useCover":
						try {
							if (this.coverCallback) {
								this.coverCallback();
							}
						} 
						catch (e) {
						}
						break;
						
				}
				break;
			case "content-document-global-created":
				//possibility to prevent popups??
				//RRprintPages2Pdf.cs.logStringMessage("DOCUMENT CREATED" + aSubject + " : " + aData);
				break;
			case "browser-lastwindow-close-granted":
				if(RRprintPages2Pdf.mainDlg && !RRprintPages2Pdf.mainDlg.closed)			
					RRprintPages2Pdf.mainDlg.close();
				break;
			case "sessionstore-windows-restored":
				var storedVersion=null;
				try {
					storedVersion = RRprintPages2Pdf.prefs.getCharPref("addon.version");
				}catch(ex){ }
				try {
				    // Firefox 4 and later; Mozilla 2 and later
				    Components.utils.import("resource://gre/modules/AddonManager.jsm");
				    AddonManager.getAddonByID(RRprintPages2Pdf.g_const.EXTENSION_NAME, 
						function(addon) {
				        	if(addon.version != storedVersion){
								RRprintPages2Pdf.prefs.clearUserPref("ui.helpsite");
								RRprintPages2Pdf.showHelp(addon.version);
								RRprintPages2Pdf.prefs.setCharPref("addon.version",addon.version);
							}
				  		});
				}
				
				catch (ex) {
				    // Firefox 3.6 and before; Mozilla 1.9.2 and before
				    var em = Components.classes["@mozilla.org/extensions/manager;1"]
				             .getService(Components.interfaces.nsIExtensionManager);
				    var addon = em.getItemForID(RRprintPages2Pdf.g_const.EXTENSION_NAME);
		        	if(addon.version != storedVersion){
						RRprintPages2Pdf.prefs.clearUserPref("ui.helpsite");
						RRprintPages2Pdf.showHelp(addon.version);
						RRprintPages2Pdf.prefs.setCharPref("addon.version",addon.version);
					}
				}
				
			    //observerService.removeObserver(this, "sessionstore-windows-restored ");
				break;  
			default:
				break;
		}

      },  
    }  
	
RRprintPages2Pdf.gPrefObserver.register();  


RRprintPages2Pdf.startConversionDlg = function(arWebPages,pars,win){
	if(this.mainDlg && !this.mainDlg.closed){
		this.mainDlg.printPages2Pdf.processHandler.addWebPages(arWebPages,pars);		
	}
	else
		this.mainDlg=this._activeConversionDialog=win.openDialog("chrome://printPages2Pdf/content/processPdf.xul",
	               "printPages2PDF_mainConversion",
	               "centerscreen,dialog=no,chrome,resizable,alwaysRaised=yes",arWebPages,pars);
			   
	//if(dlg) dlg.focus();
	
}



RRprintPages2Pdf.g_const = {
	EXTENSION_NAME : "printPages2Pdf@reinhold.ripper",
	EXTENSION_SUBDIR: "extensions",
	EXTENSION_LIBSUBDIR: "libraries",
	EXTENSION_TEMPLATEDIR: "templates",
	DEFTOCXSL_NAME: "defaultToc.xsl",
	DEFCOVER_FILE: "defCover.html",
	DEFCOVER_DIR: "defCover",
	PDF_LIB_NAME: "wkhtmltox.dll",
	TOC_DEFCAPTION_PREFIX: "__printPages2Pdf__Prefix__",
//	PDF_LIB_NAME: "wkhtmltox0.dll",
	
}

RRprintPages2Pdf.prefs = Components.classes["@mozilla.org/preferences-service;1"]  
     .getService(Components.interfaces.nsIPrefService)  
     .getBranch("extensions.RRprintPages2Pdf.");

var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                    .getService(Components.interfaces.nsIStringBundleService);

RRprintPages2Pdf.strb=stringBundleService.createBundle("chrome://printPages2Pdf/locale/printPages2Pdf.properties");					 

RRprintPages2Pdf.loader =  Components.classes["@mozilla.org/moz/jssubscript-loader;1"]  
                       .getService(Components.interfaces.mozIJSSubScriptLoader);  
					   
RRprintPages2Pdf.init();	

// Firefox 3.7 or later
RRprintPages2Pdf.am = {
	inst : {},
	init : function(){
		this.inst.AddonManager.addAddonListener(this);
	},	
	
	
	onUninstalling : function(addon,needsRestart){
		if (addon.id == RRprintPages2Pdf.g_const.EXTENSION_NAME) {
			RRprintPages2Pdf.prefs.deleteBranch("addon.version");
			this.inst.AddonManager.removeAddonListener(this);
			this.inst.AddonManager=null;
		}
	},
	
}

if ('@mozilla.org/addons/integration;1' in Components.classes) {
	Components.utils.import('resource://gre/modules/AddonManager.jsm', RRprintPages2Pdf.am.inst);
	RRprintPages2Pdf.am.init();
}
				 
					   
					 