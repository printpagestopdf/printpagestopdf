Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
Components.utils.import("resource://printPages2PdfMod/browseUrl.jsm"); 


var EXPORTED_SYMBOLS = [ "domLoader", ];

var domLoader = {
	_hiddenWin:null,
	_parentWin:null,
	_thread:null,
	_isWorking:false,
	
	get _browserParent() {
		return this.hiddenWin.document.getElementById("browserParent");
		
	},
	_urlLoader:null,
	get status(){
		return this._urlLoader.status;	
	},
	
	get loadedWin(){
		return this._urlLoader.loadedWin;
	},
	
	get thread(){
		if(!this._thread){
			 this._thread = Components.classes["@mozilla.org/thread-manager;1"]
			                        .getService(Components.interfaces.nsIThreadManager)
			                        .currentThread;
		}
		return this._thread;
	},
	
	freeResources:function(){
		if(this._urlLoader)
			this._urlLoader.deleteObject();

		if (this._hiddenWin) {
			this._hiddenWin.close();
			this._hiddenWin = null;
		}
		
	},
	
	get hiddenWin(){
		if((! this._hiddenWin) || this._hiddenWin.closed){
			if((! this._parentWin) || this._parentWin.closed) {
				this._parentWin=this._hiddenWin=null;
				return null;
			}

		if(this._hiddenWin && !this._hiddenWin.closed) return this._hiddenWin;
		
		this._hiddenWin = this._parentWin.openDialog("chrome://printPages2Pdf/content/hiddenBrowser.xul", 
													"printPages2Pdf_hiddenBrowser", 
													"centerscreen,dialog=no,chrome,resizable,dependent=yes");	
														
		RRprintPages2Pdf.domloaderLoops++;
		try {
			while (!(this._hiddenWin && this._hiddenWin.document &&
			(this._hiddenWin.document.readyState == "loaded" || this._hiddenWin.document.readyState == "complete") 
			&& !RRprintPages2Pdf.stopDomloader )) {
				this.thread.processNextEvent(true);
			}
			
	
		}
		catch(e){
		}
		RRprintPages2Pdf.domloaderLoops--;
		if (RRprintPages2Pdf.stopDomloader == true) throw new RRprintPages2Pdf.Exception("domLoader","cancel","Operation cancelled");
	
			
															
		}
		
		
				
		return this._hiddenWin;		
	},
	

	getContentWindow:function(url,callback,pageloadTimeout){
		
		if((! this._browserParent) ) return;
		
		if (this._urlLoader) {
			this._urlLoader.deleteObject();
			this._urlLoader=null;
		}
			
		this._urlLoader = new RRprintPages2Pdf._browseUrl(this._browserParent, 
								callback,
								url,pageloadTimeout);		
		
		RRprintPages2Pdf.domloaderLoops++;
		try {
			while (RRprintPages2Pdf.isStatus(this.status,RRprintPages2Pdf.RUNNING) && !RRprintPages2Pdf.stopDomloader) {
				
				this.thread.processNextEvent(true);
			}
		}
		catch(e){}
		RRprintPages2Pdf.domloaderLoops--;
		this._urlLoader.reset();
		if (RRprintPages2Pdf.stopDomloader == true) throw new RRprintPages2Pdf.Exception("domLoader","cancel","Operation cancelled");
		if(RRprintPages2Pdf.isStatus(this.status,RRprintPages2Pdf.ERROR)) throw new RRprintPages2Pdf.Exception("domLoader","loaderror","Load Error");
		
		this.fixFrames(this.loadedWin);
		
		return this.loadedWin;
	},

	//from some reason the lib ignores frames that have variable sizes. this should fix it	
	fixFrames:function(win){
		if(!win) return;

		var frames=win.document.getElementsByTagName( "iframe" );
		for ( var i = 0; i < frames.length; i++ )
		{
			var frame=frames[i];
			var cstyle=win.getComputedStyle(frame,null);
			
			frame.style.width=(parseInt(cstyle.width) + 30) + "px";
			frame.style.height=(parseInt(cstyle.height) + 0) + "px";
		}

	},
	
}
