Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = ["_editBrowserPage",];
/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);

var _editBrowserPage=function(w){
	this.win = w;
	this.title=this.win.document.title;
}

_editBrowserPage.prototype = {
	title:null,
	win : null,
	doc : null,
	mouse_down:false,
    start_pos_x : 0,
    start_pos_y : 0,
    end_pos_x : 0,
    end_pos_y : 0,
	selBox: null,
	ignoreLoad:false,
	evtMouseDown:null,
	evtMouseUp:null,
	evtMouseMove:null,
	mainWindow:null,
	
		
	onload:function(){
		if(this.ignoreLoad) return;
		
		this.doc=this.win.document;
		this.addElements();
	},
	
	addElements:function(){
		this.selBox=this.doc.createElement("div");
		this.selBox.setAttribute("id","pp2pdfSelBox");
		this.selBox.setAttribute("style","position: absolute; top: 0; left: 0; height: 0; width: 0; background-color:lightgrey; opacity:0.5;z-index:2147483647;");
		this.doc.body.appendChild(this.selBox);
		
		var ndHtml = this.doc.getElementsByTagName("html")[0];
		var me=this;
		
		this.evtMouseDown=function(e){me.onmousedown(e,me);	};		
		ndHtml.addEventListener("mousedown",this.evtMouseDown, true);				
		
		this.evtMouseMove=function(e){me.onmousemove(e,me);	};
		ndHtml.addEventListener("mousemove",this.evtMouseMove, true);				
		
		this.evtMouseUp=function(e){me.onmouseup(e,me);	};
		ndHtml.addEventListener("mouseup",this.evtMouseUp, true);				
/*		
		ndHtml.addEventListener("mouseleave",function(e){
			me.onmouseleave(e,me);
		}, false);		*/		
	},
	
	onmousedown: function(e,me){
		e.preventDefault();	
		e.stopPropagation();
		me.selBox.setCapture(true);
		me.mouse_down=true;
        me.start_pos_x = e.pageX;
        me.start_pos_y = e.pageY;
	},
	
    onmousemove: function(e,me) {	
		me.win.getSelection().removeAllRanges()
        me.end_pos_x = e.pageX;
        me.end_pos_y = e.pageY;

        if(me.mouse_down) {
            me.drawSelBox(me.start_pos_x, me.start_pos_y, me.end_pos_x, me.end_pos_y);
			me.scrollto(me);
        }

    },
	
	scrollto : function(me){
		
		var scrollY=0;
		var scrollX=0;

		if (me.end_pos_y - ( me.win.innerHeight + me.win.scrollY) > -30)
			scrollY= 30;
		else if (me.win.scrollY - me.end_pos_y  > -30)
			scrollY= -30;
			
		if (me.end_pos_x - ( me.win.innerWidth + me.win.scrollX) > -30)
			scrollX= 30;
		else if (me.win.scrollX - me.end_pos_X  > -30)
			scrollX= -30;
		
		
		if(scrollX != 0 || scrollY != 0)
			me.win.scrollBy(scrollX,scrollY);
	},
	
 	onmouseup: function(e, me){
		me.win.getSelection().removeAllRanges()
		me.end_pos_x = e.pageX;
		me.end_pos_y = e.pageY;
		
		if (me.mouse_down) {
			me.drawSelBox(me.start_pos_x, me.start_pos_y, me.end_pos_x, me.end_pos_y);
			// me.markElements();
			this.clipPage();
		}
		me.mouse_down = false;
		


	},	
/*
 	onmouseleave: function(e, me){
		me.win.getSelection().removeAllRanges()
		if (me.mouse_down) {
 		   me.markElements();
		}
		
		me.mouse_down = false;
		
		me.markElements();
	},	
*/	
	drawSelBox:function(x1, y1, x2, y2){
        this.selBox.style.left = x1 + 'px';
        this.selBox.style.top = y1 + 'px';
        this.selBox.style.width = (x2 - x1) + 'px';
        this.selBox.style.height = (y2 - y1) + 'px';	
	},
	
	
	clipPage : function()
	{
		this.selBox.parentNode.removeChild(this.selBox);
		var bodyRect=this.doc.body.getBoundingClientRect();
		this.ignoreLoad=true;

		var ndHtml = this.doc.getElementsByTagName("html")[0];		
		ndHtml.removeEventListener("mousedown",this.evtMouseDown, true);				
		ndHtml.removeEventListener("mousemove",this.evtMouseMove, true);				
		ndHtml.removeEventListener("mouseup",this.evtMouseUp, true);	
		
		var docWidth=Math.max(this.doc.documentElement["clientWidth"], this.doc.body["scrollWidth"], this.doc.documentElement["scrollWidth"], this.doc.body["offsetWidth"], this.doc.documentElement["offsetWidth"]);
		var docHeight=Math.max(this.doc.documentElement["clientHeight"], this.doc.body["scrollHeight"], this.doc.documentElement["scrollHeight"], this.doc.body["offsetHeight"], this.doc.documentElement["offsetHeight"]);
		
		var srcObjectLight = new printPages2Pdf._srcObjectLight(this.win, false);

		srcObjectLight.Title = this.title;
		srcObjectLight.cropInfo={
			docWidth:docWidth,
			docHeight:docHeight,
			cropLeft:this.start_pos_x,
			cropTop: this.start_pos_y,
			cropRight: this.end_pos_x,
			cropBottom: this.end_pos_y,
			};
		
		srcObjectLight.sourceType="cropwindow";
		var pars={};
		
		RRprintPages2Pdf.startConversionDlg([srcObjectLight],pars,this.mainWindow);
		
		//remove self reference from window
		delete this.win.ed;
		


	},
	
	
}
