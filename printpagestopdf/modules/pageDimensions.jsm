Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = [ "pageDimensions", ];

//pageDimensions.init();

var pageDimensions = {
	
	defFmt:"A4",
		
	get width(){
		var page=RRprintPages2Pdf.prefs.getCharPref("wkhtml.gopt.size.pageSize");
		var orient=RRprintPages2Pdf.prefs.getCharPref("wkhtml.gopt.orientation");
		
		if (orient == "Portrait") {
			if (page in this.sizes) 
				return this.sizes[page].w;
			else 
				return this.sizes[defFmt].w;
		}
		else {
			if(page in this.sizes)
				return this.sizes[page].h;
			else	
				return this.sizes[defFmt].h;
		}
	},
	
	get height(){
		var page=RRprintPages2Pdf.prefs.getCharPref("wkhtml.gopt.size.pageSize");	
		var orient=RRprintPages2Pdf.prefs.getCharPref("wkhtml.gopt.orientation");

		if (orient == "Portrait") {
			if (page in this.sizes) 
				return this.sizes[page].h;
			else 
				return this.sizes[defFmt].h;
		}
		else {
			if(page in this.sizes)
				return this.sizes[page].w;
			else	
				return this.sizes[defFmt].w;
		}
	},
	
	sizes: { //sizes in mm
		A0 :{w:841 ,h:1189, },
		A1 :{w:594 ,h:841, },
		A2 :{w:420 ,h:594, },
		A3 :{w:297 ,h:420, },
		A4 :{w:210 ,h:297, },
		A5 :{w:148 ,h:210, },
		A6 :{w:105 ,h:148, },
		A7 :{w:74 ,h:105, },
		A8 :{w:52 ,h:74, },
		A9 :{w:37 ,h:52, },
		B0 :{w:1000 ,h:1414, },
		B1 :{w:707 ,h:1000, },
		B2 :{w:500 ,h:707, },
		B3 :{w:353 ,h:500, },
		B4 :{w:250 ,h:353, },
		B5 :{w:176 ,h:250, },
		B6 :{w:125 ,h:176, },
		B7 :{w:88 ,h:125, },
		B8 :{w:62 ,h:88, },
		B9 :{w:44 ,h:62, },
		B10 :{w:31 ,h:44, },
		Executive :{w:184 ,h:267, },
		Legal :{w:216 ,h:356, },
		Letter :{w:216 ,h:279, },
		Tabloid :{w:279 ,h:432, },
		Ledger :{w:279 ,h:432, },
		Folio :{w:210 ,h:330, },
		DLE :{w:110 ,h:220, },
		Comm10E :{w:105 ,h:241, },
		C5E :{w:163 ,h:229, },
	},
	
}
