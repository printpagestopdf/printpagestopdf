// -*- mode: c++; tab-width: 4; indent-tabs-mode: t; eval: (progn (c-set-style "stroustrup") (c-set-offset 'innamespace 0)); -*-
// vi:set ts=4 sts=4 sw=4 noet :
//
// Copyright 2010, 2011 wkhtmltopdf authors
//
// This file is part of wkhtmltopdf.
//
// wkhtmltopdf is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// wkhtmltopdf is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with wkhtmltopdf.  If not, see <http://www.gnu.org/licenses/>.

#ifdef __WKHTMLTOX_UNDEF_QT_DLL__
#ifdef QT_DLL
#undef QT_DLL
#endif
#endif

#include "pdfconverter_p.hh"
#include <QAuthenticator>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QPair>
#include <QPrintEngine>
#include <QTimer>
#include <QWebFrame>
#include <QWebPage>
#include <QWebSettings>
#include <algorithm>
#include <qapplication.h>
#include <qfileinfo.h>
 #include <QtXmlPatterns>
#ifdef Q_OS_WIN32
#include <fcntl.h>
#include <io.h>
#endif

#include "dllbegin.inc"
using namespace wkhtmltopdf;
using namespace wkhtmltopdf::settings;

#define STRINGIZE_(x) #x
#define STRINGIZE(x) STRINGIZE_(x)

DLL_LOCAL QMap<QWebPage *, PageObject *> PageObject::webPageToObject;

//RR
extern QSizeF qt_paperSizeToQSizeF(QPrinter::PaperSize size);
extern double qt_multiplierForUnit(QPrinter::Unit unit, int resolution);
const qreal  PdfConverter::millimeterToPointMultiplier = 2.83464567;


struct DLL_LOCAL StreamDumper {
	QFile out;
	QTextStream stream;

	StreamDumper(const QString & path): out(path), stream(&out) {
		out.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text);
		stream.setCodec("UTF-8");
	}
};

/*!
  \file pageconverter.hh
  \brief Defines the PdfConverter class
*/

/*!
  \file pageconverter_p.hh
  \brief Defines the PdfConverterPrivate class
*/

bool DLL_LOCAL looksLikeHtmlAndNotAUrl(QString str) {
	QString s = str.split("?")[0];
	return s.count('<') > 0 || s.count('<') > 0;
}

PdfConverterPrivate::PdfConverterPrivate(PdfGlobal & s, PdfConverter & o) :
	settings(s), pageLoader(s.load),
	out(o), printer(0), painter(0), webPrinter(0)
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
    , measuringHFLoader(s.load), hfLoader(s.load), tocLoader1(s.load), tocLoader2(s.load)
	, tocLoader(&tocLoader1), tocLoaderOld(&tocLoader2)
    , outline(0), currentHeader(0), currentFooter(0)
#endif
{
	//RR workaround for two pages instead of one
	isOnePage=false;

#ifdef  __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	phaseDescriptions.push_back("Loading pages");
	phaseDescriptions.push_back("Counting pages");
	phaseDescriptions.push_back("Loading TOC");
	phaseDescriptions.push_back("Resolving links");
	phaseDescriptions.push_back("Loading headers and footers");
#else
	phaseDescriptions.push_back("Loading page");
#endif
	phaseDescriptions.push_back("Printing pages");
	phaseDescriptions.push_back("Done");

	connect(&pageLoader, SIGNAL(loadProgress(int)), this, SLOT(loadProgress(int)));
	connect(&pageLoader, SIGNAL(loadFinished(bool)), this, SLOT(pagesLoaded(bool)));
	connect(&pageLoader, SIGNAL(error(QString)), this, SLOT(forwardError(QString)));
	connect(&pageLoader, SIGNAL(warning(QString)), this, SLOT(forwardWarning(QString)));

#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	measuringHFLoader.isHdrFooter=true;
    connect(&measuringHFLoader, SIGNAL(loadProgress(int)), this, SLOT(loadProgress(int)));
    connect(&measuringHFLoader, SIGNAL(loadFinished(bool)), this, SLOT(measuringHeadersLoaded(bool)));
    connect(&measuringHFLoader, SIGNAL(error(QString)), this, SLOT(forwardError(QString)));
    connect(&measuringHFLoader, SIGNAL(warning(QString)), this, SLOT(forwardWarning(QString)));

    hfLoader.isHdrFooter=true;
	connect(&hfLoader, SIGNAL(loadProgress(int)), this, SLOT(loadProgress(int)));
	connect(&hfLoader, SIGNAL(loadFinished(bool)), this, SLOT(headersLoaded(bool)));
	connect(&hfLoader, SIGNAL(error(QString)), this, SLOT(forwardError(QString)));
	connect(&hfLoader, SIGNAL(warning(QString)), this, SLOT(forwardWarning(QString)));

    connect(&tocLoader1, SIGNAL(loadProgress(int)), this, SLOT(loadProgress(int)));
	connect(&tocLoader1, SIGNAL(loadFinished(bool)), this, SLOT(tocLoaded(bool)));
	connect(&tocLoader1, SIGNAL(error(QString)), this, SLOT(forwardError(QString)));
	connect(&tocLoader1, SIGNAL(warning(QString)), this, SLOT(forwardWarning(QString)));

	connect(&tocLoader2, SIGNAL(loadProgress(int)), this, SLOT(loadProgress(int)));
	connect(&tocLoader2, SIGNAL(loadFinished(bool)), this, SLOT(tocLoaded(bool)));
	connect(&tocLoader2, SIGNAL(error(QString)), this, SLOT(forwardError(QString)));
	connect(&tocLoader2, SIGNAL(warning(QString)), this, SLOT(forwardWarning(QString)));
#endif

	if ( ! settings.viewportSize.isEmpty())
	{
		QStringList viewportSizeList = settings.viewportSize.split("x");
		int width = viewportSizeList.first().toInt();
		int height = viewportSizeList.last().toInt();
		viewportSize = QSize(width,height);
	}

}

PdfConverterPrivate::~PdfConverterPrivate() {
	clearResources();
}


void PdfConverterPrivate::beginConvert() {
	error=false;
	progressString = "0%";
	currentPhase=0;
	errorCode=0;

#ifndef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	if (objects.size() > 1) {
		emit out.error("This version of wkhtmltopdf is build against an unpatched version of QT, and does not support more then one input document.");
		fail();
		return;
	}
#endif
    bool headerHeightsCalcNeeded = false;

	for (QList<PageObject>::iterator i=objects.begin(); i != objects.end(); ++i) {
		PageObject & o=*i;
		settings::PdfObject & s = o.settings;

        if (!s.header.htmlUrl.isEmpty() ) {
            if (looksLikeHtmlAndNotAUrl(s.header.htmlUrl)) {
                emit out.error("--header-html should be a URL and not a string containing HTML code.");
                fail();
                return;
            }

            // we should auto calculate header if top margin is not specified
            if (settings.margin.top.first == -1) {
                headerHeightsCalcNeeded = true;
                o.measuringHeader = &measuringHFLoader.addResource(
                    MultiPageLoader::guessUrlFromString(s.header.htmlUrl), s.load)->page;
            } else {
                // or just set static values
                // add spacing to prevent moving header out of page
                o.headerReserveHeight = settings.margin.top.first + s.header.spacing;
            }
        }

        if (!s.footer.htmlUrl.isEmpty()) {
            if (looksLikeHtmlAndNotAUrl(s.footer.htmlUrl)) {
                emit out.error("--footer-html should be a URL and not a string containing HTML code.");
                fail();
                return;
            }

            if (settings.margin.bottom.first == -1) {
                // we should auto calculate footer if top margin is not specified
                headerHeightsCalcNeeded = true;
                o.measuringFooter = &measuringHFLoader.addResource(
                    MultiPageLoader::guessUrlFromString(s.footer.htmlUrl), s.load)->page;
            } else {
                // or just set static values
                // add spacing to prevent moving footer out of page
                o.footerReserveHeight = settings.margin.bottom.first + s.footer.spacing;
            }
        }

		if (!s.isTableOfContent) {
			o.loaderObject = pageLoader.addResource(s.page, s.load, &o.data);
			o.page = &o.loaderObject->page;
			PageObject::webPageToObject[o.page] = &o;
			updateWebSettings(o.page->settings(), s.web);
			//RR set page width to viewportSize
			if (viewportSize.isValid() && ! viewportSize.isEmpty())
				o.page->setPreferredContentsSize(viewportSize);
		}
	}

	emit out.phaseChanged();
	loadProgress(0);

    if (headerHeightsCalcNeeded) {
        // preload header/footer to check their heights
        measuringHFLoader.load();
    } else {
        // set defaults if top or bottom mergin is not specified
        if (settings.margin.top.first == -1) {
            settings.margin.top.first = 10;
        }
        if (settings.margin.bottom.first == -1) {
            settings.margin.bottom.first = 10;
        }
        
        // set static header/footer reserve heights
        objects[0].headerReserveHeight = settings.margin.top.first;
        objects[0].footerReserveHeight = settings.margin.bottom.first;

        pageLoader.load();
    }
}

// calculates header/footer height
// returns millimeters
qreal PdfConverterPrivate::calculateHeaderHeight(PageObject & object, QWebPage & header) {
    typedef QPair<QWebElement, QString> p_t;

    TempFile   tempObj;
    QString    tempFile = tempObj.create(settings.outputFormat == "ps"?".ps":".pdf");

    QPainter * testPainter = new QPainter();
    QPrinter * testPrinter = createPrinter(tempFile);

    if (!testPainter->begin(testPrinter)) {
        emit out.error("Unable to write to temp location");
        return 0.0;
    }

    QWebPrinter wp(header.mainFrame(), testPrinter, *testPainter);
    qreal height = wp.elementLocation(header.mainFrame()->findFirstElement("body")).second.height();

    delete testPainter;
    delete testPrinter;

    return (height / PdfConverter::millimeterToPointMultiplier);
}

QPrinter * PdfConverterPrivate::createPrinter(const QString & tempFile) {
    QPrinter * printer = new QPrinter(settings.resolution);


    if (settings.dpi != -1) printer->setResolution((settings.dpi < 150)?150:settings.dpi);
    //Tell the printer object to print the file <out>

    printer->setOutputFormat(
        (settings.outputFormat == "ps" || (settings.outputFormat == "" && settings.out.endsWith(".ps", Qt::CaseInsensitive)))?
        QPrinter::PostScriptFormat : QPrinter::PdfFormat
        );
    printer->setOutputFileName(tempFile);

    if ((settings.size.height.first != -1) && (settings.size.width.first != -1)) {
        printer->setPaperSize(QSizeF(settings.size.width.first,settings.size.height.first + 100), settings.size.height.second);
    } else {
        printer->setPaperSize(settings.size.pageSize);
    }

    printer->setOrientation(settings.orientation);
    printer->setColorMode(settings.colorMode);

    return printer;
}

void PdfConverterPrivate::preprocessPage(PageObject & obj) {
	currentObject++;
	if (obj.settings.isTableOfContent) {
		obj.pageCount = 1;
		pageCount += 1;
		outline->addEmptyWebPage();
		return;
	}
	if (!obj.loaderObject || obj.loaderObject->skip) return;

	int tot = objects.size();
	progressString = QString("Object ")+QString::number(currentObject)+QString(" of ")+QString::number(tot);
	emit out.progressChanged((currentObject)*100 / tot);

	
	painter->save();

	if (viewportSize.isValid() && ! viewportSize.isEmpty()) {
		obj.page->setViewportSize(viewportSize);
		obj.page->mainFrame()->setScrollBarPolicy(Qt::Vertical,Qt::ScrollBarAlwaysOff);
		obj.page->mainFrame()->setScrollBarPolicy(Qt::Horizontal,Qt::ScrollBarAlwaysOff);
	}

	QWebPrinter wp(obj.page->mainFrame(), printer, *painter);
	//RR workaround for two pages instead of one
//	obj.pageCount = obj.settings.pagesCount? (isOnePage?1:wp.pageCount()): 0;
	obj.pageCount = obj.settings.pagesCount? wp.pageCount(): 0;
	pageCount += obj.pageCount;

	
	if (obj.settings.includeInOutline)
		outline->addWebPage(obj.page->mainFrame()->title(), wp, obj.page->mainFrame(),
							obj.settings, obj.localLinks, obj.anchors);
	else
		outline->addEmptyWebPage();
	painter->restore();
}

//RR
QSizeF PdfConverterPrivate::pageHeight() {

	const qreal maxPDFHeightmm=5080;
	const int guessHeightmm=100;

    QPainter * testPainter = new QPainter();
    QPrinter * testPrinter = new QPrinter(settings.resolution);
    if (settings.dpi != -1) testPrinter->setResolution((settings.dpi < 150)?150:settings.dpi);


    testPrinter->setOutputFormat(
        (settings.outputFormat == "ps" || (settings.outputFormat == "" && settings.out.endsWith(".ps", Qt::CaseInsensitive)))?
        QPrinter::PostScriptFormat : QPrinter::PdfFormat
        );

    testPrinter->setOutputFileName(lout);

    //Setup margins and papersize
    /*
    testPrinter->setPageMargins(settings.margin.left.first, objects[0].headerReserveHeight,
                                settings.margin.right.first, objects[0].footerReserveHeight,
                                settings.margin.left.second);*/

    testPrinter->setPageMargins(settings.margin.left.first, 0,
                                settings.margin.right.first, 0,
                                settings.margin.left.second);

	//factor for unit to millimeter
    double f=(qt_multiplierForUnit(settings.size.height.second, 1) / qt_multiplierForUnit(QPrinter::Millimeter, 1)) ;

	QSizeF pageSizeMm;
	if ((settings.size.height.first != -1) && (settings.size.width.first != -1)) {
//		testPrinter->setPaperSize(QSizeF(settings.size.width.first,settings.size.height.first), settings.size.height.second);
		pageSizeMm=QSizeF(f * settings.size.width.first,  f  * settings.size.height.first);
	} else {
		//testPrinter->setPaperSize(settings.size.pageSize);
		pageSizeMm=qt_paperSizeToQSizeF(settings.size.pageSize);

	}
	testPrinter->setPaperSize(QSizeF(pageSizeMm.width(),guessHeightmm), QPrinter::Millimeter);

    testPrinter->setOrientation(settings.orientation);
    testPrinter->setColorMode(settings.colorMode);

	if (viewportSize.isValid() && ! viewportSize.isEmpty()) {
		for (int d=0; d < objects.size(); ++d)
		{
			objects[d].page->setPreferredContentsSize(viewportSize);
			objects[d].page->setViewportSize(viewportSize);
			objects[d].page->mainFrame()->setScrollBarPolicy(Qt::Vertical,Qt::ScrollBarAlwaysOff);
			objects[d].page->mainFrame()->setScrollBarPolicy(Qt::Horizontal,Qt::ScrollBarAlwaysOff);
		}
	}

    testPainter->begin(testPrinter);
    QWebPrinter wp(objects[0].page->mainFrame(), testPrinter, *testPainter);

/*
    qreal height = pageSizeMm.height() * wp.pageCount() + f * objects[0].headerReserveHeight +
    													  f * objects[0].footerReserveHeight ;
    													  */
    qreal height = guessHeightmm * wp.pageCount() + f * objects[0].headerReserveHeight +
    													  f * objects[0].footerReserveHeight ;

    if(height > maxPDFHeightmm)
    	height = maxPDFHeightmm;
    else
    	isOnePage=true;

    delete testPainter;
    delete testPrinter;


	return QSizeF(pageSizeMm.width(),height)  ;
}

/*!
 * Prepares printing out the document to the pdf file
 */
void PdfConverterPrivate::pagesLoaded(bool ok) {
	if (errorCode == 0) errorCode = pageLoader.httpErrorCode();
	if (!ok) {
		fail();
		return;
	}

	lout = settings.out;
	if (settings.out == "-") {
#ifndef Q_OS_WIN32
		 if (QFile::exists("/dev/stdout"))
			 lout = "/dev/stdout";
		 else
#endif
			 lout = tempOut.create(settings.outputFormat == "ps"?".ps":".pdf");
	}
	if (settings.out.isEmpty())
	  lout = tempOut.create(settings.outputFormat == "ps"?".ps":".pdf");

	printer = new QPrinter(settings.resolution);

    //RR crashes if dpi below 150
    if (settings.dpi != -1) printer->setResolution((settings.dpi < 150)?150:settings.dpi);



	//Tell the printer object to print the file <out>

	printer->setOutputFormat(
		(settings.outputFormat == "ps" || (settings.outputFormat == "" && settings.out.endsWith(".ps", Qt::CaseInsensitive)))?
	    QPrinter::PostScriptFormat : QPrinter::PdfFormat
		);
	printer->setOutputFileName(lout);

	//We currently only support margins with the same unit
	if (settings.margin.left.second != settings.margin.right.second ||
		settings.margin.left.second != settings.margin.top.second ||
		settings.margin.left.second != settings.margin.bottom.second) {
		emit out.error("Currently all margin units must be the same!");
		fail();
		return;
	}

    //Setup margins and papersize
    printer->setPageMargins(settings.margin.left.first, objects[0].headerReserveHeight,
                                settings.margin.right.first, objects[0].footerReserveHeight,
                                settings.margin.left.second);

	//RR guessPageLength
    if (settings.guessPageLength && objects.size() == 1){
        QSizeF pageSizes=pageHeight();
    	printer->setPaperSize(pageSizes,QPrinter::Millimeter);

    }
    else if ((settings.size.height.first != -1) && (settings.size.width.first != -1)) {
		printer->setPaperSize(QSizeF(settings.size.width.first,settings.size.height.first), settings.size.height.second);
	} else {
		printer->setPaperSize(settings.size.pageSize);
	}



	printer->setOrientation(settings.orientation);
	printer->setColorMode(settings.colorMode);

	if (!printer->isValid()) {
		emit out.error("Unable to write to destination");
		fail();
		return;
	}

#ifndef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	//If you do not have the hacks you get this crappy solution
	printer->setCollateCopies(settings.copies);
	printer->setCollateCopies(settings.collate);

	printDocument();
#else
	printer->printEngine()->setProperty(QPrintEngine::PPK_UseCompression, settings.useCompression);
	printer->printEngine()->setProperty(QPrintEngine::PPK_ImageQuality, settings.imageQuality);
	printer->printEngine()->setProperty(QPrintEngine::PPK_ImageDPI, settings.imageDPI);

	painter = new QPainter();
	//QTextStream(stderr) << "OBJEKTE: " << objects.size() << endl;
	title = settings.documentTitle;
	for (int d=0; d < objects.size(); ++d) {
		if (title != "") break;
		if (!objects[d].loaderObject || objects[d].loaderObject->skip ||
			objects[d].settings.isTableOfContent) continue;
		title = objects[d].page->mainFrame()->title();
	}
	printer->setDocName(title);
	if (!painter->begin(printer)) {
		emit out.error("Unable to write to destination");
		fail();
		return;
	}
	/*
	QRect pr=printer->pageRect();
	float fx=   pr.width() / (float)viewportSize.width();

	QRectF clip=QRectF(216 *fx,163 ,590 * fx,230);
	painter->setClipRect(clip);
*/
	currentPhase = 1;
	emit out.phaseChanged();
	outline = new Outline(settings);
	//This is the first render face, it is done to calculate:
	// * The number of pages of each document
	// * A visual ordering of the header element
	// * The location and page number of each header
	pageCount = 0;
	currentObject = 0;

	for (int d=0; d < objects.size(); ++d)
	{
		preprocessPage(objects[d]);

	}
	actualPages = pageCount * settings.copies;

	loadTocs();

#endif
}

void PdfConverterPrivate::loadHeaders() {
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	currentPhase = 4;
	emit out.phaseChanged();
	bool hf=false;

	int pageNumber=1;
	for (int d=0; d < objects.size(); ++d) {
		PageObject & obj = objects[d];
		if (!obj.loaderObject || obj.loaderObject->skip) continue;

		settings::PdfObject & ps = obj.settings;
		for (int op=0; op < obj.pageCount; ++op) {
			if (!ps.header.htmlUrl.isEmpty() || !ps.footer.htmlUrl.isEmpty()) {
				QHash<QString, QString> parms;
				fillParms(parms, pageNumber, obj);
				parms["sitepage"] = QString::number(op+1);
				parms["sitepages"] = QString::number(obj.pageCount);
				hf = true;
				if (!ps.header.htmlUrl.isEmpty())
					obj.headers.push_back(loadHeaderFooter(ps.header.htmlUrl, parms, ps) );
				if (!ps.footer.htmlUrl.isEmpty()) {
					obj.footers.push_back(loadHeaderFooter(ps.footer.htmlUrl, parms, ps) );
				}
			}
			if (ps.pagesCount) ++pageNumber;
		}
	}
	if (hf)
		hfLoader.load();
	else
		printDocument();
#endif
}


void PdfConverterPrivate::loadTocs() {
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	std::swap(tocLoaderOld, tocLoader);
	tocLoader->clearResources();

	bool toc=false;
	for (int d=0; d < objects.size(); ++d) {
		PageObject & obj = objects[d];
		settings::PdfObject & ps = obj.settings;
		if (!ps.isTableOfContent) continue;
		obj.clear();

		QString style = ps.tocXsl;
		if (style.isEmpty()) {
			style = obj.tocStyleFile.create(".xsl");
			StreamDumper styleDump(style);
			dumpDefaultTOCStyleSheet(styleDump.stream, ps.toc);
		} else
			style = MultiPageLoader::guessUrlFromString(style).toString();

		QString path = obj.tocFile.create(".xml");
		StreamDumper sd(path);
		outline->dump(sd.stream, style);

		//RR TOC manual xslt
		QString out;
		QXmlQuery query(QXmlQuery::XSLT20);
		query.setFocus(QUrl(path));
		query.setQuery(QUrl(style));
		query.evaluateTo(&out);
		out.replace("xmlns:ns0=\"http://www.w3.org/1999/xhtml\"","");
		out.replace(" ns0:", " ");

		//RR TOC write transformed file
		QString transfFile=obj.tocHtmlFile.create(".html");
	    QFile file(transfFile);
	    file.open(QIODevice::WriteOnly | QIODevice::Text);
	    QTextStream fout(&file);
	    fout.setCodec("UTF-8");
	    fout << out;
	    fout.flush();
	    // optional, as QFile destructor will already do it:
	    file.close();


		obj.loaderObject = tocLoader->addResource(QUrl(transfFile), ps.load);
//		obj.loaderObject = tocLoader->addResource(path, ps.load);
		obj.page = &obj.loaderObject->page;
		PageObject::webPageToObject[obj.page] = &obj;
		updateWebSettings(obj.page->settings(), ps.web);
		toc= true;

	}


	if (toc) {
		if (currentPhase != 2) {
			currentPhase = 2;
			emit out.phaseChanged();
		}
		tocLoader->load();
	} else
		tocLoaded(true);
#endif
}

#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
void PdfConverterPrivate::findLinks(QWebFrame * frame, QVector<QPair<QWebElement, QString> > & local, QVector<QPair<QWebElement, QString> > & external, QHash<QString, QWebElement> & anchors) {
	//RR cover page use only external links
	bool ulocal=true, uexternal=true, isCoverPage=false;
	if (PageObject::webPageToObject.contains(frame->page())) {
		ulocal = PageObject::webPageToObject[frame->page()]->settings.useLocalLinks;
		uexternal  = PageObject::webPageToObject[frame->page()]->settings.useExternalLinks;

		isCoverPage=PageObject::webPageToObject[frame->page()]->settings.isCover;
	}
	if (!ulocal && !uexternal) return;
	foreach (const QWebElement & elm, frame->findAllElements("a")) {
		QString n=elm.attribute("name");
		if (n.startsWith("__WKANCHOR_")) anchors[n] = elm;

		QString h=elm.attribute("href");
		if (h.startsWith("__WKANCHOR_") ) {
			local.push_back( qMakePair(elm, h) );
		} else {
			QUrl href(h);
			if (href.isEmpty()) continue;
			href=frame->baseUrl().resolved(href);

			if (urlToPageObj.contains(href.toString(QUrl::RemoveFragment))) {
			if (ulocal) {
					PageObject * p = urlToPageObj[href.toString(QUrl::RemoveFragment)];
					QWebElement e;
					if (!href.hasFragment())
						e = p->page->mainFrame()->findFirstElement("body");
					else {
						e = p->page->mainFrame()->findFirstElement("a[name=\""+href.fragment()+"\"]");
						if (e.isNull())
							e = p->page->mainFrame()->findFirstElement("*[id=\""+href.fragment()+"\"]");
						if (e.isNull())
							e = p->page->mainFrame()->findFirstElement("*[name=\""+href.fragment()+"\"]");
					}
					if (!e.isNull()) {
						if(!isCoverPage)
						{
							p->anchors[href.toString()] = e;
							local.push_back( qMakePair(elm, href.toString()) );
						}
						else
							external.push_back( qMakePair(elm, href.toString()) );
					}

				}
			} else if (uexternal) {
				// pass the unresolved url to WebKit. WebKit will resolve it
				// depending upon the type of url - filepath, web-uri etc.
				//RR WebKit resolves Site internal links to file://sdfsadfsdf
				//external.push_back( qMakePair(elm, h) );
				external.push_back( qMakePair(elm, href.toString()) );
			}
		}
	}
}

void PdfConverterPrivate::fillParms(QHash<QString, QString> & parms, int page, const PageObject & object) {
	outline->fillHeaderFooterParms(page, parms, object.settings);
	//RR workaround for two pages instead of one
//	if(isOnePage)
	//	parms["topage"] = "1";

	parms["doctitle"] = title;
	parms["title"] = object.page?object.page->mainFrame()->title():"";
	QDateTime t(QDateTime::currentDateTime());
	parms["time"] = t.time().toString(Qt::SystemLocaleShortDate);
	parms["date"] = t.date().toString(Qt::SystemLocaleShortDate);
}


void PdfConverterPrivate::endPage(PageObject & object, bool hasHeaderFooter, int objectPage, int pageNumber) {
	typedef QPair<QWebElement, QString> p_t;
	settings::PdfObject & s = object.settings;

    // save margin values
    qreal leftMargin, topMargin, rightMargin, bottomMargin;
    printer->getPageMargins(&leftMargin, &topMargin, &rightMargin, &bottomMargin, settings.margin.left.second);
	if (hasHeaderFooter) {
		QHash<QString, QString> parms;
		fillParms(parms, pageNumber, object);

		//Webkit used all kinds of crazy coordinate transformation, and font setup
		//We save it here and restore some sane defaults
		painter->save();
		painter->resetTransform();

		int h=printer->height();
		int w=printer->width();

		double spacing = s.header.spacing * printer->height() / printer->heightMM();
		//If needed draw the header line
		if (s.header.line) painter->drawLine(0, -spacing, w, -spacing);
		//RR workaround for bug that screenRes doesnt print hyperlinks with fontsize < 9
		if(settings.resolution == QPrinter::ScreenResolution && s.header.fontSize < 9)
			s.header.fontSize = 9;
		//Guess the height of the header text
		painter->setFont(QFont(s.header.fontName, s.header.fontSize));
		int dy = painter->boundingRect(0, 0, w, h, Qt::AlignTop, "M").height();
		//Draw the header text
		QRect r=QRect(0, 0-dy-spacing, w, h);
		painter->drawText(r, Qt::AlignTop | Qt::AlignLeft, hfreplace(s.header.left, parms));
		painter->drawText(r, Qt::AlignTop | Qt::AlignHCenter, hfreplace(s.header.center, parms));
		painter->drawText(r, Qt::AlignTop | Qt::AlignRight, hfreplace(s.header.right, parms));

		spacing = s.footer.spacing * printer->height() / printer->heightMM();
		//IF needed draw the footer line
		if (s.footer.line) painter->drawLine(0, h + spacing, w, h + spacing);
		//RR workaround for bug that screenRes doesnt print hyperlinks with fontsize < 9
		if(settings.resolution == QPrinter::ScreenResolution && s.footer.fontSize < 9)
			s.footer.fontSize = 9;
		//Guess the height of the footer text
		painter->setFont(QFont(s.footer.fontName, s.footer.fontSize));
		dy = painter->boundingRect(0, 0, w, h, Qt::AlignTop, "M").height();
		//Draw the footer text
		r=QRect(0,0,w,h+dy+ spacing);
		painter->drawText(r, Qt::AlignBottom | Qt::AlignLeft, hfreplace(s.footer.left, parms));
		painter->drawText(r, Qt::AlignBottom | Qt::AlignHCenter, hfreplace(s.footer.center, parms));
		painter->drawText(r, Qt::AlignBottom | Qt::AlignRight, hfreplace(s.footer.right, parms));

		//Restore Webkit's crazy scaling and font settings
		painter->restore();
	}

	//if (!object.headers.empty()) {
	//object.headers[objectPage];
	if (currentHeader) {
		QWebPage * header = currentHeader;
		painter->save();
		painter->resetTransform();
		double spacing = s.header.spacing * printer->height() / printer->heightMM();
        // clear vertical margins for proper header rendering
        printer->setPageMargins(leftMargin, 0, rightMargin, 0, settings.margin.left.second);
		painter->translate(0, -spacing);
		QWebPrinter wp(header->mainFrame(), printer, *painter);
		painter->translate(0,-wp.elementLocation(header->mainFrame()->findFirstElement("body")).second.height());
		QVector<p_t> local;
		QVector<p_t> external;
		QHash<QString, QWebElement> anchors;
		findLinks(header->mainFrame(), local, external, anchors);
		foreach (const p_t & p, local) {
			QRectF r = wp.elementLocation(p.first).second;
			painter->addLink(r, p.second);
		}
		foreach (const p_t & p, external) {
			QRectF r = wp.elementLocation(p.first).second;
			painter->addHyperlink(r, QUrl(p.second));

		}
		wp.spoolPage(1);
        // restore margins
        printer->setPageMargins(leftMargin, topMargin, rightMargin, bottomMargin, settings.margin.left.second);
		painter->restore();
	}

	if (currentFooter) {
		QWebPage * footer=currentFooter;
		painter->save();
		painter->resetTransform();
		double spacing = s.footer.spacing * printer->height() / printer->heightMM();
		painter->translate(0, printer->height()+ spacing);
        // clear vertical margins for proper header rendering
        printer->setPageMargins(leftMargin, 0, rightMargin, 0, settings.margin.left.second);

		QWebPrinter wp(footer->mainFrame(), printer, *painter);
		QVector<p_t> local;
		QVector<p_t> external;
		QHash<QString, QWebElement> anchors;
		findLinks(footer->mainFrame(), local, external, anchors);
		foreach (const p_t & p, local) {
			QRectF r = wp.elementLocation(p.first).second;
			painter->addLink(r, p.second);
		}
		foreach (const p_t & p, external) {
			QRectF r = wp.elementLocation(p.first).second;
			painter->addHyperlink(r, QUrl(p.second));
		}
		wp.spoolPage(1);
        // restore margins
        printer->setPageMargins(leftMargin, topMargin, rightMargin, bottomMargin, settings.margin.left.second);
		painter->restore();
	}

}
#endif

void PdfConverterPrivate::handleTocPage(PageObject & obj) {
	painter->save();
	QWebPrinter wp(obj.page->mainFrame(), printer, *painter);
	//RR workaround for two pages instead of one
//	int pc = obj.settings.pagesCount? (isOnePage?1:wp.pageCount()): 0;
	int pc = obj.settings.pagesCount? wp.pageCount(): 0;
	if (pc != obj.pageCount) {
		obj.pageCount = pc;
		tocChanged=true;
	}
	pageCount += obj.pageCount;
	tocChanged = outline->replaceWebPage(obj.number, obj.settings.toc.captionText, wp, obj.page->mainFrame(), obj.settings, obj.localLinks, obj.anchors) || tocChanged;
	painter->restore();
}


void PdfConverterPrivate::tocLoaded(bool ok) {
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	if (errorCode == 0) errorCode = tocLoader->httpErrorCode();
#endif
	if (!ok) {
		fail();
		return;
	}
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	tocChanged = false;
	pageCount = 0;
	currentObject = 0;
	for (int d=0; d < objects.size(); ++d) {
		++currentObject;
		if (!objects[d].loaderObject || objects[d].loaderObject->skip) continue;
		if (!objects[d].settings.isTableOfContent) {
			pageCount += objects[d].pageCount;
			continue;
		}
		handleTocPage(objects[d]);
	}

	actualPages = pageCount * settings.copies;
	if (tocChanged)
		loadTocs();
	else {
		//Find and resolve all local links
		currentPhase = 3;
		emit out.phaseChanged();

		QHash<QString, int> urlToDoc;
		for (int d=0; d < objects.size(); ++d) {
			if (!objects[d].loaderObject || objects[d].loaderObject->skip) continue;
			if (objects[d].settings.isTableOfContent) continue;
			urlToPageObj[ objects[d].page->mainFrame()->url().toString(QUrl::RemoveFragment) ] = &objects[d];
		}

		for (int d=0; d < objects.size(); ++d) {
			if (!objects[d].loaderObject || objects[d].loaderObject->skip) continue;
			progressString = QString("Object ")+QString::number(d+1)+QString(" of ")+QString::number(objects.size());
			emit out.progressChanged((d+1)*100 / objects.size());
			findLinks(objects[d].page->mainFrame(), objects[d].localLinks, objects[d].externalLinks, objects[d].anchors );
		}

		loadHeaders();
	}
#endif
}


void PdfConverterPrivate::measuringHeadersLoaded(bool ok) {
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
    if (errorCode == 0) errorCode = measuringHFLoader.httpErrorCode();
#endif
    if (!ok) {
        fail();
        return;
    }

    for (int d=0; d < objects.size(); ++d) {
        PageObject & obj = objects[d];
        if (obj.measuringHeader) {
            // add spacing to prevent moving header out of page
            obj.headerReserveHeight = calculateHeaderHeight(obj, *obj.measuringHeader) + obj.settings.header.spacing;
        }

        if (obj.measuringFooter) {
            // add spacing to prevent moving footer out of page
            obj.footerReserveHeight = calculateHeaderHeight(obj, *obj.measuringFooter) + obj.settings.header.spacing;
        }
    }

    pageLoader.load();
}

void PdfConverterPrivate::headersLoaded(bool ok) {
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	if (errorCode == 0) errorCode = hfLoader.httpErrorCode();
#endif
	if (!ok) {
		fail();
		return;
	}
	printDocument();
}


void PdfConverterPrivate::spoolPage(size_t page) {
	progressString = QString("Page ") + QString::number(actualPage) + QString(" of ") + QString::number(actualPages);
	emit out.progressChanged(actualPage * 100 / actualPages);
	if (actualPage != 1)
		printer->newPage();

	webPrinter->spoolPage(page+1);
	foreach (QWebElement elm, pageFormElements[page+1]) {
		QString type = elm.attribute("type");
		QString tn = elm.tagName();
		QString name = elm.attribute("name");
		if (tn == "TEXTAREA" || type == "text" || type == "password") {
			painter->addTextField(
				webPrinter->elementLocation(elm).second,
				tn == "TEXTAREA"?elm.toPlainText():elm.attribute("value"),
				name,
				tn == "TEXTAREA",
				type == "password",
				elm.evaluateJavaScript("this.readonly;").toBool(),
				elm.hasAttribute("maxlength")?elm.attribute("maxlength").toInt():-1
				);
		} else if (type == "checkbox") {
			painter->addCheckBox(
				webPrinter->elementLocation(elm).second,
				elm.evaluateJavaScript("this.checked;").toBool(),
				name,
				elm.evaluateJavaScript("this.readonly;").toBool());
		}
	}
	for (QHash<QString, QWebElement>::iterator i=pageAnchors[page+1].begin();
		 i != pageAnchors[page+1].end(); ++i) {
		QRectF r = webPrinter->elementLocation(i.value()).second;
		painter->addAnchor(r, i.key());
	}
	for (QVector< QPair<QWebElement,QString> >::iterator i=pageLocalLinks[page+1].begin();
		 i != pageLocalLinks[page+1].end(); ++i) {
		QRectF r = webPrinter->elementLocation(i->first).second;
		painter->addLink(r, i->second);
	}
	for (QVector< QPair<QWebElement,QString> >::iterator i=pageExternalLinks[page+1].begin();
		 i != pageExternalLinks[page+1].end(); ++i) {
		QRectF r = webPrinter->elementLocation(i->first).second;
		painter->addHyperlink(r, QUrl(i->second));
	}
	endPage(objects[currentObject], pageHasHeaderFooter, page, pageNumber);
	actualPage++;
}

void PdfConverterPrivate::spoolTo(size_t page) {
	int pc=settings.collate?1:settings.copies;
	const settings::PdfObject & ps = objects[currentObject].settings;

	while (objectPage < page ) {
		for (int pc_=0; pc_ < pc; ++pc_)
			spoolPage(objectPage);
		if (ps.pagesCount) ++pageNumber;
		++objectPage;
		
		//TODO free header and footer
		currentHeader=NULL;
		currentFooter=NULL;
	}
}

void PdfConverterPrivate::beginPrintObject(PageObject & obj) {
	if (obj.number != 0) 
		endPrintObject(objects[obj.number-1]);
	currentObject = obj.number;
	
	if (!obj.loaderObject || obj.loaderObject->skip) return;
	const settings::PdfObject & ps = obj.settings;
	pageHasHeaderFooter = ps.header.line || ps.footer.line ||
		!ps.header.left.isEmpty() || !ps.footer.left.isEmpty() ||
		!ps.header.center.isEmpty() || !ps.footer.center.isEmpty() ||
		!ps.header.right.isEmpty() || !ps.footer.right.isEmpty();
	painter->save();

	if (ps.produceForms) {
		foreach (QWebElement elm, obj.page->mainFrame()->findAllElements("input"))
			elm.setStyleProperty("color","white");
		foreach (QWebElement elm, obj.page->mainFrame()->findAllElements("textarea"))
			elm.setStyleProperty("color","white");
	}
	
	//output
	webPrinter = new QWebPrinter(obj.page->mainFrame(), printer, *painter);
	QString l1=obj.page->mainFrame()->url().path().split("/").back()+"#";
	QString l2=obj.page->mainFrame()->url().toString() + "#";
	
	outline->fillAnchors(obj.number, obj.anchors);

	//Sort anchors and links by page
	for (QHash<QString, QWebElement>::iterator i=obj.anchors.begin();
		 i != obj.anchors.end(); ++i)
		pageAnchors[webPrinter->elementLocation(i.value()).first][i.key()] = i.value();
	
	for (QVector< QPair<QWebElement,QString> >::iterator i=obj.localLinks.begin();
		 i != obj.localLinks.end(); ++i)
		pageLocalLinks[webPrinter->elementLocation(i->first).first].push_back(*i);
	
	for (QVector< QPair<QWebElement,QString> >::iterator i=obj.externalLinks.begin();
		 i != obj.externalLinks.end(); ++i)
		pageExternalLinks[webPrinter->elementLocation(i->first).first].push_back(*i);
	
	if (ps.produceForms) {
		foreach (const QWebElement & elm, obj.page->mainFrame()->findAllElements("input"))
			pageFormElements[webPrinter->elementLocation(elm).first].push_back(elm);
		foreach (const QWebElement & elm, obj.page->mainFrame()->findAllElements("textarea"))
			pageFormElements[webPrinter->elementLocation(elm).first].push_back(elm);
	}
	emit out.producingForms(obj.settings.produceForms);
	out.emitCheckboxSvgs(obj.settings.load);

	objectPage = 0;
}


void PdfConverterPrivate::handleHeader(QWebPage * frame, size_t page) {
	spoolTo(page);
	currentHeader = frame;
}

void PdfConverterPrivate::handleFooter(QWebPage * frame, size_t page) {
	spoolTo(page);
	currentFooter = frame;
}

void PdfConverterPrivate::endPrintObject(PageObject & obj) {
	//RR workaround for two pages instead of one
//	if (webPrinter != 0) spoolTo(isOnePage?1:webPrinter->pageCount());
	if (webPrinter != 0) spoolTo(webPrinter->pageCount());
	pageAnchors.clear();
	pageLocalLinks.clear();
	pageExternalLinks.clear();
	pageFormElements.clear();
	if (webPrinter != 0) {
	QWebPrinter *tmp = webPrinter;
		webPrinter = 0;
		delete tmp;

		painter->restore();
	}
}
			

void PdfConverterPrivate::printDocument() {
#ifndef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	currentPhase = 1;
	emit out.phaseChanged();
	objects[0].page->mainFrame()->print(printer);
	progressString = "";
	emit out.progressChanged(-1);
#else
	actualPage=1;

 	int cc=settings.collate?settings.copies:1;


	currentPhase = 5;
	emit out.phaseChanged();

	progressString = "Preparing";
	emit out.progressChanged(0);
	for (int cc_=0; cc_ < cc; ++cc_) {
		pageNumber=1;
		for (int d=0; d < objects.size(); ++d) {

			beginPrintObject(objects[d]);
			//RR workaround for two pages instead of one
//			int pageCount = webPrinter != 0 ? (isOnePage?1:webPrinter->pageCount()) : 0;
			int pageCount = webPrinter != 0 ? webPrinter->pageCount() : 0;
			//const settings::PdfObject & ps = objects[d].settings;

			for(size_t i=0; i < pageCount; ++i) {
				if (!objects[d].headers.empty())
					handleHeader(objects[d].headers[i], i);
				if (!objects[d].footers.empty())
					handleFooter(objects[d].footers[i], i);
			}

		}
		endPrintObject(objects[objects.size()-1]);
 	}
	outline->printOutline(printer);

	if (!settings.dumpOutline.isEmpty()) {
		StreamDumper sd(settings.dumpOutline);
		outline->dump(sd.stream, "");
	}

 	painter->end();
#endif
	if (settings.out == "-" && lout != "/dev/stdout") {
		QFile i(lout);
		QFile o;
#ifdef Q_OS_WIN32
		_setmode(_fileno(stdout), _O_BINARY);
#endif
		if ( !i.open(QIODevice::ReadOnly) ||
			!o.open(stdout,QIODevice::WriteOnly) ||
			!MultiPageLoader::copyFile(i,o) ) {
			emit out.error("Count not write to stdout");
			fail();
			return;
		}
	}

	if (settings.out.isEmpty()) {
		QFile i(lout);
		if (!i.open(QIODevice::ReadOnly)) {
			emit out.error("Reading output failed");
			fail();
		}
		outputData = i.readAll();
	}
	clearResources();
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	currentPhase = 6;
#else
	currentPhase = 2;
#endif
	emit out.phaseChanged();
	convertionDone = true;
	emit out.finished(true);

	qApp->exit(0); // quit qt's event handling
}

#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
QWebPage * PdfConverterPrivate::loadHeaderFooter(QString url, const QHash<QString, QString> & parms, const settings::PdfObject & ps) {
	QUrl u = MultiPageLoader::guessUrlFromString(url);
	for (QHash<QString, QString>::const_iterator i=parms.begin(); i != parms.end(); ++i)
		u.addQueryItem(i.key(), i.value());
	return &hfLoader.addResource(u, ps.load)->page;

}

/*!
 * Replace some variables in a string used in a header or footer
 * \param q the string to substitute in
 */
QString PdfConverterPrivate::hfreplace(const QString & q, const QHash<QString, QString> & parms) {
	QString r=q;
	for (QHash<QString, QString>::const_iterator i=parms.begin(); i != parms.end(); ++i)
		r=r.replace("["+i.key()+"]", i.value(), Qt::CaseInsensitive);
	return r;
}
#endif

void PdfConverterPrivate::clearResources() {
	objects.clear();
	pageLoader.clearResources();
#ifdef __EXTENSIVE_WKHTMLTOPDF_QT_HACK__
	hfLoader.clearResources();
	tocLoader1.clearResources();
	tocLoader2.clearResources();

	if (outline) {
		Outline * tmp = outline;
		outline = 0;
		delete tmp;
	}


#endif

	if (printer) {
		QPrinter * tmp = printer;
		printer = 0;
		delete tmp;
	}

	if (painter) {
		QPainter * tmp = painter;
		painter = 0;
		delete tmp;
	}

}

Converter & PdfConverterPrivate::outer() {
	return out;
}

/*!
  \class PdfConverter
  \brief Class responsible for converting html pages to pdf
  \todo explain something about the conversion process here, and mention stages
*/

/*!
  \brief Create a page converter object based on the supplied settings
  \param settings Settings for the conversion
*/
PdfConverter::PdfConverter(settings::PdfGlobal & settings):
	d(new PdfConverterPrivate(settings, *this)) {
}

/*!
  \brief The destructor for the page converter object
*/
PdfConverter::~PdfConverter() {
	PdfConverterPrivate *tmp = d;
	d = 0;
	tmp->deleteLater();;

}

/*!
  \brief add a resource we want to convert
  \param url The url of the object we want to convert
*/
//RR  set webpage size
void PdfConverter::addResource(const settings::PdfObject & page, const QString * data) {
  d->objects.push_back( PageObject(page,d->viewportSize,data) );
  d->objects.back().number = d->objects.size()-1;
}

const QByteArray & PdfConverter::output() {
  return d->outputData;
}


/*!
  \brief Returns the settings object associated with the page converter
*/
const settings::PdfGlobal & PdfConverter::globalSettings() const {
	return d->settings;
}


/*!
  \fn PdfConverter::warning(const QString & message)
  \brief Signal emitted when some non fatal warning occurs during conversion
  \param message The warning message
*/

/*!
  \fn PdfConverter::error(const QString & message)
  \brief Signal emitted when a fatal error has occurred during conversion
  \param message A message describing the fatal error
*/

/*!
  \fn PdfConverter::phaseChanged()
  \brief Signal emitted when the converter has reached a new phase
*/

/*!
  \fn PdfConverter::progressChanged()
  \brief Signal emitted when some progress has been done in the conversion phase
*/

/*!
  \fn PdfConverter::finised()
  \brief Signal emitted when conversion has finished.
*/


ConverterPrivate & PdfConverter::priv() {
	return *d;
}
