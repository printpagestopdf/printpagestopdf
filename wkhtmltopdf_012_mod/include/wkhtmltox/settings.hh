// Copyright 2010 wkhtmltopdf authors
//
// This file is part of wkhtmltopdf.
//
// wkhtmltopdf is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// wkhtmltopdf is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with wkhtmltopdf.  If not, see <http://www.gnu.org/licenses/>.

#ifndef __SETTINGS_HH__
#define __SETTINGS_HH__
#include <wkhtmltopdf/loadsettings.hh>
#include <wkhtmltopdf/websettings.hh>
#include <QNetworkProxy>
#include <QPrinter>
#include <QString>

#include <wkhtmltopdf/dllbegin.inc>
namespace wkhtmltopdf {
namespace settings {

typedef QPair<qreal, QPrinter::Unit> UnitReal;

/*! \brief Settings consdering margins */
struct DLL_PUBLIC Margin {
	Margin();
	//!Margin applied to the top of the page
	UnitReal top;
	//!Margin applied to the right of the page
	UnitReal right;
	//!Margin applied to the bottom of the page
	UnitReal bottom;
	//!Margin applied to the leftp of the page
	UnitReal left;
};

/*! \brief Settings considering page size */
struct DLL_PUBLIC Size {
	Size();
	//! What size paper should we use
	QPrinter::PageSize pageSize;
	//!Height of the page
	UnitReal height;
	//!Width of the page
	UnitReal width;
};

/*! \brief Settings considdirng the table of content */
struct DLL_PUBLIC TableOfContent {
	TableOfContent();
	//! Should we print dots between the name and the page number?
	bool useDottedLines;
	//! Name af the TOC
	QString captionText;
	//! Link from TOC to section headers
	bool forwardLinks;
	//! Link from section headers to TOC
	bool backLinks;
	//! How fare should we indent on every level
	QString indentation;
	//! Factor we should scale the font with on every level
	float fontScale;
};

/*! \brief Class holding all user setting.
    This class holds all the user settings, settings can be filled in by hand,
    or with other methods.
    \sa CommandLineParser::parse()
*/
struct DLL_PUBLIC Global {
	Global();

	//! Size related settings
	Size size;

	//! Be less verbose
	bool quiet;

	//! Should we use the graphics system
	bool useGraphics;

	//! Should we orientate in landscape or portrate
	QPrinter::Orientation orientation;

	//! Color or grayscale
	QPrinter::ColorMode colorMode;

	//! What overall resolution should we use
	QPrinter::PrinterMode resolution;

	//! What dpi should be used when printing
	int dpi;

	//! When pagenumbers are printed, apply this offset to them all
	int pageOffset;

	//! How many copies do we wan to print
	int copies;

	//RR
	//! try to set pagelength to webpage length
	bool guessPageLength;
	//RR implement for dll
	QString viewportSize;


	//! Should be print a whole copy before beginnig the next
	bool collate;

	//! Should we generate an outline and put it into the pdf file
	bool outline;

	//! Maximal depth of the generated outline
	int outlineDepth;

	//! dump outline to this filename
	QString dumpOutline;

	//! The file where in to store the output
	QString out;

	QString documentTitle;

	bool useCompression;

	//! Margin related settings
	Margin margin;

	//! Specify the output format we should use
	QString outputFormat;

	int imageDPI;
	int imageQuality;

	LoadGlobal load;

	QString get(const char * name);
	bool set(const char * name, const QString & value);
};

/*! \brief Settings considering headers and footers */
struct DLL_PUBLIC HeaderFooter {
	HeaderFooter();
	//! Size of the font used to render the text
	int fontSize;
	//! Name of font used to render text
	QString fontName;
	//! Text to render at the left
	QString left;
	//! Text to render at the right
	QString right;
	//! Text to render at the center
	QString center;
	//! Should a line seperate the header/footer and the document
	bool line;
	//! Url of the document the html document that should be used as a header/footer
	QString htmlUrl;
	//! Spacing
	float spacing;
};

struct DLL_PUBLIC Page {
	Page();
	//! Settings regarding the TOC
	TableOfContent toc;

	QString page;

	//! Header related settings
	HeaderFooter header;

	//! Header related settings
	HeaderFooter footer;

	//! Should external links be links in the PDF
	bool useExternalLinks;

	//! Should internal links be links in the PDF
	bool useLocalLinks;

	//! Replacements
	QList< QPair<QString, QString> > replacements;

	//! Convert forms on the pages into PDF forms
	bool produceForms;

	LoadPage load;

	Web web;

	bool includeInOutline;

	bool pagesCount;

	bool isTableOfContent;

	//RR cover
	bool isCover;

	QString tocXsl;

	QString get(const char * name);
	bool set(const char * name, const QString & value);
};

DLL_PUBLIC QPrinter::PageSize strToPageSize(const char * s, bool * ok=0);
DLL_PUBLIC QString pageSizeToStr(QPrinter::PageSize ps);

DLL_PUBLIC UnitReal strToUnitReal(const char * s, bool * ok=0);
DLL_PUBLIC QString unitRealToStr(const UnitReal & ur, bool * ok);

DLL_PUBLIC QPrinter::Orientation strToOrientation(const char * s, bool * ok=0);
DLL_PUBLIC QString orientationToStr(QPrinter::Orientation o);

DLL_PUBLIC QPrinter::PrinterMode strToPrinterMode(const char * s, bool * ok=0);
DLL_PUBLIC QString printerModeToStr(QPrinter::PrinterMode o);

DLL_PUBLIC QPrinter::ColorMode strToColorMode(const char * s, bool * ok=0);
DLL_PUBLIC QString colorModeToStr(QPrinter::ColorMode o);

}
}
#include <wkhtmltopdf/dllend.inc>
#endif //__SETTINGS_HH__
