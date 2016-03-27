Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = [ "archives","fsElement","objType" ,"arcFavorites"];

var	objType = {
		directory : 0,
		rootDir : 1,
		pdf : 2,
		other : 3,
	}

var arcFavorites = {
	_favorites : null,
	_dataFile : null,
	get dataFile(){
		if(this._dataFile)
			return this._dataFile;
		
		this._dataFile=RRprintPages2Pdf.ProfileDir.clone();
		this._dataFile.append("pp2pdf_fav.json");
			
		return this._dataFile;
	},
	
	get favorites(){
		if(this._favorites)
			return this._favorites;
			
		if(!this.dataFile.exists()) 
			return null;
		
		var JSONar=RRprintPages2Pdf.ReadTextFile(this.dataFile);
		
		this._favorites=JSON.parse(JSONar);
		
		return this._favorites;
			
	},
	
	add : function(path){
		if(!this.favorites)
			this._favorites={};
		
		if(path in this._favorites) return;
		
		this._favorites[path]=true;
		
		RRprintPages2Pdf.WriteTextFile(this.dataFile,JSON.stringify(this._favorites));
		
	},
	
	remove : function(path){
		if(!this.favorites)
			return;
			
		if(path in this._favorites){
			delete this._favorites[path];
			RRprintPages2Pdf.WriteTextFile(this.dataFile,JSON.stringify(this._favorites));
		}		
	},
	
}

var fsElement = function(){
  		this.path = null;
		this.type = null;
		this.isOpen = false;
		this.hasChildren = true;
		this.level = 0;
		this.name = null;
			
}


fsElement.prototype = {
	isFavorite : function(){
		return (this.path in arcFavorites.favorites);
	},
	
	objFile : function() {
		var f = Components.classes["@mozilla.org/file/local;1"].
       	createInstance(Components.interfaces.nsILocalFile);
		f.initWithPath(this.path);
		return f;			
	},
	
	fromFile : function(entry){
		var f=new fsElement();
		f.type = entry.isDirectory()?objType.directory:(entry.leafName.search(/.pdf$/i) > -1?objType.pdf:objType.other);
		f.path=entry.path;
		f.name = entry.leafName;
		return f;			
	},
	
	fromProps:function(obj){
		var f=new fsElement();
		for(var x in obj){
			if(x in f)
				f[x]=obj[x];
		}
		
		return f;
		
	},
	
	equals : function(obj){
		var retVal = false;
		
		if ( !("name" in obj) || obj.name != this.name) return false;
		if ( !("path" in obj) || obj.path != this.path) return false;
		
		return true;
	},
	
}


var archives = {
	_dataFile : null,
	get dataFile(){
		if(this._dataFile)
			return this._dataFile;
		
		this._dataFile=RRprintPages2Pdf.ProfileDir.clone();
		this._dataFile.append("pp2pdf_arc.json");
			
		return this._dataFile;
	},
	
	_archives : [],	
	get Archives(){
		if (this._archives.length == 0) {
			this.loadArchives();
		}
		
		var retAr=this._archives.slice(0);

		if (RRprintPages2Pdf.prefs.getBoolPref("archive.showMyDocuments") === true)			
			retAr.unshift(this.myfiles);
		
		if (RRprintPages2Pdf.prefs.getBoolPref("archive.showRecent") === true)			
			retAr.unshift(this.recent);
		
		
		return retAr;
				
	},
	
	_recent:null,
	get recent(){
		if(this._recent)
			return this._recent;
		this._recent=fsElement.prototype.fromFile(RRprintPages2Pdf.RecentDir);
		this._recent.type=objType.rootDir;
		this._recent.name=RRprintPages2Pdf.strb.GetStringFromName("recent.folder.name");
		this._recent.isSpecial=true;
		
		return this._recent;
	},
	
	_myfiles:null,
	get myfiles(){
		if(this._myfiles)
			return this._myfiles;

		this._myfiles=fsElement.prototype.fromFile(RRprintPages2Pdf.DocumentsDir);
		this._myfiles.type=objType.rootDir;
		if(RRprintPages2Pdf.osString == "WINNT")
			this._myfiles.name=RRprintPages2Pdf.strb.GetStringFromName("mydocuments.folder.win.name");
		else
			this._myfiles.name=RRprintPages2Pdf.strb.GetStringFromName("mydocuments.folder.linux.name");
		this._myfiles.isSpecial=true;
		
		return this._myfiles;
	},
	
	//par: fsElement
	remove:function(objArc){
		//refresh Archives if necessary
		var archives=this.Archives;
		
		var i=0;
		for(;i < this._archives.length; i++){
			if(this._archives[i].path == objArc.path)
				break;
		}
		if(i < this._archives.length){
			this._archives.splice(i,1);
		}		

		this.saveArchives();
	},

	//objArc: fsElement
	//newFile: nsiFile
	replace:function(objArc,newFile){
		//refresh Archives if necessary
		var archives=this.Archives;
		
		var i=0;
		for(;i < this._archives.length; i++){
			if(this._archives[i].path == objArc.path)
				break;
		}
		if(i < this._archives.length){
			var f=fsElement.prototype.fromFile(newFile);
			f.type=objType.rootDir;
			this._archives.splice(i,1,f);
		}		

		this.saveArchives();
	},


	
	//par: nsiFile
	add:function(file){
		//refresh Archives if necessary
		var archives=this.Archives;

		var f=fsElement.prototype.fromFile(file);
		f.type=objType.rootDir;
		
		this._archives.push(f);
		this.saveArchives();
		
		return f;
	},
	
	
	loadArchives:function(){
     if(!this.dataFile.exists()) return;

      var arcsDelete=false;
      var data=RRprintPages2Pdf.ReadTextFile(this.dataFile);
	  
	  var arcs=JSON.parse(data);
	  for(var i=0;i < arcs.length;i++){
	  	var arc=fsElement.prototype.fromProps(arcs[i]);
		if (arc.objFile().exists()) {
			this._archives.push(fsElement.prototype.fromProps(arcs[i]));
		}
		else {
			arcsDelete=true;
		}				
	  }
	  
	  if(arcsDelete)
	  	this.saveArchives();
	},
	
	saveArchives:function(){
		RRprintPages2Pdf.WriteTextFile(this.dataFile,JSON.stringify(this._archives));

	},
}


