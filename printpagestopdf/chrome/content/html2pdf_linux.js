/** 
 * RRprintPages2Pdf namespace. 
 */  
if (typeof RRprintPages2Pdf == "undefined") {  
  var RRprintPages2Pdf = {};  
};


//RRprintPages2Pdf.cs = XPCOM.getService("@mozilla.org/consoleservice;1");

RRprintPages2Pdf.g_const = {
	EXTENSION_NAME : "printPages2Pdf@reinhold.ripper",
	EXTENSION_SUBDIR: "extensions",
	EXTENSION_LIBSUBDIR: "libraries",
//	PDF_LIB_NAME: "wkhtmltox0_10.dll", //interface to 0.10 binary
//	PDF_LIB_NAME: "wkhtmltox.dll", //Interface to 0.9 binary
//	PDF_LIB_NAME: "wkhtmltox0.dll", //original DLL
	PDF_LIB_NAME: "libwkhtmltox.so", //Linux lib
	PDF_LIB_NAME_64: "libwkhtmltox_64.so", //Linux lib
	
}

var _html2Pdf = function() {
		  		
	//this.loadDefinitions();	
}

_html2Pdf.prototype = {
	_libs:null,
	lastDocTitle:"empty",	
	stopProcessing:false,
	is64bit:false,
}

_html2Pdf.prototype.startup = function(outFile, inUrls,globalPrefs,lastDocTitle,is64bit){
	this.is64bit=is64bit;

	this.loadDefinitions();	
	this.lastDocTitle=lastDocTitle;
	
	outFile += "/WebPage.pdf";
	
	this.doConversion(outFile, inUrls,globalPrefs);
}


_html2Pdf.prototype.progress_changed_callback = function(pConverter, iProgress){
	var strProgress=this.wkhtmltopdf_progress_string(pConverter);
	postMessage(JSON.stringify({type:"progress_changed",iProgress:iProgress,strProgress:strProgress.readString(),}));
}

_html2Pdf.prototype.phase_changed_callback = function(pConverter){
	var iPhase=this.wkhtmltopdf_current_phase(pConverter);
	var desc=this.wkhtmltopdf_phase_description(pConverter,iPhase);
	postMessage(JSON.stringify({type:"phase_changed",phase:iPhase,desc:desc.readString(),}));
}

_html2Pdf.prototype.error_callback = function(pConverter, strError){
	postMessage(JSON.stringify({type:"error",strError:strError.readString(),}));
}

_html2Pdf.prototype.warning_callback = function(pConverter, strWarning){
	postMessage(JSON.stringify({type:"warning",strWarning:strWarning.readString(),}));
}

_html2Pdf.prototype.convert = function(outFile,inUrls,conv){


	this.loadDefinitions();	
	


	var ret=this.wkhtmltopdf_convert(conv);

	var httpErr=this.wkhtmltopdf_http_error_code(conv);
	
	this.wkhtmltopdf_destroy_converter(conv);
	
	//Dont deinit if you want to reuse the library!!
	//this.wkhtmltopdf_deinit();
	
	var retVal=(ret && ( httpErr == 0 ));
	
	postMessage(JSON.stringify({type:"finished",result:retVal,}));
	
	return (ret && ( httpErr == 0 ));
	
}



_html2Pdf.prototype.doConversion = function(outFile,inUrls,globalPrefs){
	
	this.wkhtmltopdf_init(false);
	
	var gs=this.wkhtmltopdf_create_global_settings();
	
	this.wkhtmltopdf_set_global_setting(gs,"out",outFile);
	
	if(this.stopProcessing) return;
	
	for (var p in globalPrefs) {
		if(this.stopProcessing) return;
		this.wkhtmltopdf_set_global_setting(gs,p,globalPrefs[p]);
	}



	var conv = this.wkhtmltopdf_create_converter(gs);


	var progress_callback = this.wkhtmltopdf_int_callbackPtr(this.progress_changed_callback,this);  	
	this.wkhtmltopdf_set_progress_changed_callback(conv,progress_callback);

	var warning_callback = this.wkhtmltopdf_str_callbackPtr(this.warning_callback);  	
	this.wkhtmltopdf_set_warning_callback(conv,warning_callback);

	var error_callback = this.wkhtmltopdf_str_callbackPtr(this.error_callback);  	
	this.wkhtmltopdf_set_error_callback(conv,error_callback);

	var phase_callback = this.wkhtmltopdf_void_callbackPtr(this.phase_changed_callback,this);  	
	this.wkhtmltopdf_set_phase_changed_callback(conv,phase_callback);


	if(this.stopProcessing) return;

	
    for (var i = 0; i < inUrls.length; i++) {
		var os = this.wkhtmltopdf_create_object_settings();
		this.wkhtmltopdf_set_object_setting(os, "page", inUrls[i].url);
		if(this.stopProcessing) return;
		
		if (inUrls[i].customObjectPrefs) {
			var customObjectPrefs=inUrls[i].customObjectPrefs;
			for (var p in customObjectPrefs) {
				if(this.stopProcessing) return;
				this.wkhtmltopdf_set_object_setting(os, p, customObjectPrefs[p]);
				
			}
		}
		

		this.wkhtmltopdf_add_object(conv, os, null);
	}


	if(this.stopProcessing) return;

	var ret=this.wkhtmltopdf_convert(conv);

	var httpErr=this.wkhtmltopdf_http_error_code(conv);
	
	this.wkhtmltopdf_destroy_converter(conv);
	
	//Dont deinit if you want to reuse the library!!
	this.wkhtmltopdf_deinit();
	
	var retVal=(ret && ( httpErr == 0 ));
	
	if (!retVal)	
		postMessage(JSON.stringify({type:"warning",strWarning:"Javascrip warning",}));
		
	postMessage(JSON.stringify({type:"finished",
								result:retVal,
								outFile:outFile,
								lastDocTitle:this.lastDocTitle,
								}));
	
	
}

_html2Pdf.prototype.destroy = function(){
	this.stopProcessing=true;

	for(var lib in this._libs)
		this._libs[lib].close();
	
	delete this;
}

_html2Pdf.prototype.loadDefinitions = function(){

	this._libs={};
	
	var pdflibPath = RRprintPages2Pdf.ExtensionDir.clone();
	pdflibPath.append(RRprintPages2Pdf.g_const.EXTENSION_LIBSUBDIR);


	if(this.is64bit)
		pdflibPath.append(RRprintPages2Pdf.g_const.PDF_LIB_NAME_64);
	else
		pdflibPath.append(RRprintPages2Pdf.g_const.PDF_LIB_NAME);
	
	this._libs.pdflib = ctypes.open(pdflibPath.path);


	this.wkhtmltopdf_init = this._libs.pdflib.declare("wkhtmltopdf_init",
                        ctypes.default_abi,
                        ctypes.int32_t,
                        ctypes.int32_t 
						);
	this.wkhtmltopdf_deinit = this._libs.pdflib.declare("wkhtmltopdf_deinit",
                        ctypes.default_abi,
                        ctypes.void_t
						);



	this.wkhtmltopdf_convert = this._libs.pdflib.declare("wkhtmltopdf_convert",
                        ctypes.default_abi,
                        ctypes.bool,
                        ctypes.voidptr_t // ptr to converter
						);


	this.wkhtmltopdf_http_error_code = this._libs.pdflib.declare("wkhtmltopdf_http_error_code",
                        ctypes.default_abi,
                        ctypes.int32_t,
                        ctypes.voidptr_t // ptr to converter
						);

	this.wkhtmltopdf_destroy_converter = this._libs.pdflib.declare("wkhtmltopdf_destroy_converter",
                        ctypes.default_abi,
                        ctypes.void_t,
                        ctypes.voidptr_t // ptr to converter
						);



	this.wkhtmltopdf_create_global_settings = this._libs.pdflib.declare("wkhtmltopdf_create_global_settings",
                        ctypes.default_abi,
                        ctypes.voidptr_t // ptr to global settings
						);
	
	this.wkhtmltopdf_create_object_settings = this._libs.pdflib.declare("wkhtmltopdf_create_object_settings",
                        ctypes.default_abi,
                        ctypes.voidptr_t // ptr to object settings
						);


	this.wkhtmltopdf_create_converter = this._libs.pdflib.declare("wkhtmltopdf_create_converter",
                        ctypes.default_abi,
                        ctypes.voidptr_t, // ptr to converter (out)
                        ctypes.voidptr_t // ptr to global settings
						);

	this.wkhtmltopdf_add_object = this._libs.pdflib.declare("wkhtmltopdf_add_object",
                        ctypes.default_abi,
                        ctypes.void_t,
                        ctypes.voidptr_t, // ptr to converter
                        ctypes.voidptr_t, // ptr to global settings
                        ctypes.voidptr_t // null
						);


	this.wkhtmltopdf_set_global_setting = this._libs.pdflib.declare("wkhtmltopdf_set_global_setting",
                        ctypes.default_abi,
                        ctypes.void_t,
						ctypes.voidptr_t, // ptr to global settings
						ctypes.char.ptr, //attribut
						ctypes.char.ptr //value						 
						);


	this.wkhtmltopdf_set_object_setting = this._libs.pdflib.declare("wkhtmltopdf_set_object_setting",
                        ctypes.default_abi,
                        ctypes.void_t,
						ctypes.voidptr_t, // ptr to object settings
						ctypes.char.ptr, //attribut
						ctypes.char.ptr //value						 
						);

	this.wkhtmltopdf_current_phase = this._libs.pdflib.declare("wkhtmltopdf_current_phase",
                        ctypes.default_abi,
                        ctypes.int,
						ctypes.voidptr_t // converter pointer
						);

	this.wkhtmltopdf_phase_description = this._libs.pdflib.declare("wkhtmltopdf_phase_description",
                        ctypes.default_abi,
                        ctypes.char.ptr,
						ctypes.voidptr_t, // converter pointer
                        ctypes.int //number of phase
						);

	this.wkhtmltopdf_progress_string = this._libs.pdflib.declare("wkhtmltopdf_progress_string",
                        ctypes.default_abi,
                        ctypes.char.ptr,
						ctypes.voidptr_t // converter pointer
						);

// callbacks

	this.wkhtmltopdf_int_callbackPtr = ctypes.FunctionType(
                        ctypes.default_abi,
                        ctypes.void_t,
                        [ctypes.voidptr_t,  ctypes.int32_t, ] //ptr to converter, percentage done
						).ptr;  
	
	
	this.wkhtmltopdf_set_progress_changed_callback = this._libs.pdflib.declare("wkhtmltopdf_set_progress_changed_callback",
                        ctypes.default_abi,
                        ctypes.void_t,
                        ctypes.voidptr_t, // ptr to converter
                        this.wkhtmltopdf_int_callbackPtr //Progress callback
						);


	this.wkhtmltopdf_void_callbackPtr = ctypes.FunctionType(
                        ctypes.default_abi,
                        ctypes.void_t,
                        [ctypes.voidptr_t,  ] //ptr to converter
						).ptr;  
	
	
	this.wkhtmltopdf_set_phase_changed_callback = this._libs.pdflib.declare("wkhtmltopdf_set_phase_changed_callback",
                        ctypes.default_abi,
                        ctypes.void_t,
                        ctypes.voidptr_t, // ptr to converter
                        this.wkhtmltopdf_void_callbackPtr //Progress callback
						);



	this.wkhtmltopdf_str_callbackPtr = ctypes.FunctionType(
                        ctypes.default_abi,
                        ctypes.void_t,
                        [ctypes.voidptr_t,  ctypes.char.ptr, ] //ptr to converter, message
						).ptr;  
	
	
	this.wkhtmltopdf_set_error_callback = this._libs.pdflib.declare("wkhtmltopdf_set_error_callback",
                        ctypes.default_abi,
                        ctypes.void_t,
                        ctypes.voidptr_t, // ptr to converter
                        this.wkhtmltopdf_str_callbackPtr //Progress callback
						);
		
	
	this.wkhtmltopdf_set_warning_callback = this._libs.pdflib.declare("wkhtmltopdf_set_warning_callback",
                        ctypes.default_abi,
                        ctypes.void_t,
                        ctypes.voidptr_t, // ptr to converter
                        this.wkhtmltopdf_str_callbackPtr //Progress callback
						);


}

RRprintPages2Pdf.html2Pdf = new _html2Pdf();

var _file = function(initPath) {
	if(initPath) this._path=initPath;
}

_file.prototype = {
	_path:null,
	
	get path() {
		return this._path;
	},
	
	initWithPath: function(p){
		this._path = p;
	},
	
	append:function(part){
		//different for linux OS
//		this._path += "\\" + part;
		this._path += "/" + part;
	},
	
	clone:function(){
		return new _file(this._path);
	},
}

onmessage = function(event){
	if (!("cmd" in event.data)) return;
	
	switch(event.data.cmd){
		case "open":
			RRprintPages2Pdf.ExtensionDir=new _file(event.data.ExtensionDir);
			RRprintPages2Pdf.html2Pdf.startup(event.data.outFile,
												event.data.inUrls,
												event.data.globalPrefs,
												event.data.lastDocTitle,
												event.data.is64bit);
			break;
		case "close":
			RRprintPages2Pdf.html2Pdf.destroy();
			close();
			break;
			
		default:
			break;
		
	}
	
}
