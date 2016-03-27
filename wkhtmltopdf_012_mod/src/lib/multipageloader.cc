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

#include "multipageloader_p.hh"
#include <QFile>
#include <QFileInfo>
#include <QNetworkCookie>
#include <QNetworkDiskCache>
#include <QTimer>
#include <QUuid>
//RR
#include <QWebElement>
#include <QWebSecurityOrigin>

namespace wkhtmltopdf {
/*!
  \file multipageloader.hh
  \brief Defines the MultiPageLoader class
*/

/*!
  \file multipageloader_p.hh
  \brief Defines the MultiPageLoaderPrivate class
*/

//RR set webpage size
LoaderObject::LoaderObject(QWebPage & p): page(p), skip(false) {};

MyNetworkAccessManager::MyNetworkAccessManager(const settings::LoadPage & s): settings(s) {
	if ( !s.cacheDir.isEmpty() ){
		QNetworkDiskCache *cache = new QNetworkDiskCache(this);
		cache->setCacheDirectory(s.cacheDir);
		QNetworkAccessManager::setCache(cache);
	}
}

void MyNetworkAccessManager::allow(QString path) {
	QString x = QFileInfo(path).canonicalFilePath();
	if (x.isEmpty()) return;
	allowed.insert(x);
}

QNetworkReply * MyNetworkAccessManager::createRequest(Operation op, const QNetworkRequest & req, QIODevice * outgoingData) {
	if (req.url().scheme() == "file" && settings.blockLocalFileAccess) {
		bool ok=false;
		QString path = QFileInfo(req.url().toLocalFile()).canonicalFilePath();
		QString old = "";
		while (path != old) {
			if (allowed.contains(path)) {
				ok=true;
				break;
			}
			old = path;
			path = QFileInfo(path).path();
		}
		if (!ok) {
			QNetworkRequest r2 = req;
			emit warning(QString("Blocked access to file %1").arg(QFileInfo(req.url().toLocalFile()).canonicalFilePath()));
			r2.setUrl(QUrl("about:blank"));
			return QNetworkAccessManager::createRequest(op, r2, outgoingData);
		}
	}
	QNetworkRequest r3 = req;
	if (settings.repeatCustomHeaders) {
		typedef QPair<QString, QString> HT;
		foreach (const HT & j, settings.customHeaders)
			r3.setRawHeader(j.first.toAscii(), j.second.toAscii());
	}
	return QNetworkAccessManager::createRequest(op, r3, outgoingData);
}


MyQWebPage::MyQWebPage(ResourceObject & res): resource(res) {}

void MyQWebPage::javaScriptAlert(QWebFrame *, const QString & msg) {
	resource.warning(QString("Javascript alert: %1").arg(msg));
}

bool MyQWebPage::javaScriptConfirm(QWebFrame *, const QString & msg) {
	resource.warning(QString("Javascript confirm: %1 (answered yes)").arg(msg));
	return true;
}

bool MyQWebPage::javaScriptPrompt(QWebFrame *, const QString & msg, const QString & defaultValue, QString * result) {
	resource.warning(QString("Javascript prompt: %1 (answered %2)").arg(msg,defaultValue));
	result = (QString*)&defaultValue;
	return true;
}

void MyQWebPage::javaScriptConsoleMessage(const QString & message, int lineNumber, const QString & sourceID) {
	if (resource.settings.debugJavascript)
		resource.warning(QString("%1:%2 %3").arg(sourceID).arg(lineNumber).arg(message));
}

bool MyQWebPage::shouldInterruptJavaScript() {

	if (resource.settings.stopSlowScripts) {
		resource.warning("A slow script was stopped");
		return true;
	}
	return false;
}

ResourceObject::ResourceObject(MultiPageLoaderPrivate & mpl, const QUrl & u, const settings::LoadPage & s):
	networkAccessManager(s),
	url(u),
	loginTry(0),
	progress(0),
	finished(false),
	signalPrint(false),
	multiPageLoader(mpl),
	webPage(*this),
	lo(webPage),
	httpErrorCode(0),
	settings(s) {
	//RR
	bFileLoaded=false;

	connect(&networkAccessManager, SIGNAL(authenticationRequired(QNetworkReply*, QAuthenticator *)),this,
	        SLOT(handleAuthenticationRequired(QNetworkReply *, QAuthenticator *)));
	foreach (const QString & path, s.allowed)
		networkAccessManager.allow(path);
	if (url.scheme() == "file")
		networkAccessManager.allow(url.toLocalFile());

	connect(&webPage, SIGNAL(loadStarted()), this, SLOT(loadStarted()));
	connect(&webPage, SIGNAL(loadProgress(int)), this, SLOT(loadProgress(int)));
	connect(&webPage, SIGNAL(loadFinished(bool)), this, SLOT(loadFinished(bool)));
	connect(&webPage, SIGNAL(printRequested(QWebFrame*)), this, SLOT(printRequested(QWebFrame*)));
	//RR
	//connect(&webPage, SIGNAL(frameCreated(QWebFrame*)), this, SLOT(frameCreated(QWebFrame*)),Qt::DirectConnection);

	//If some ssl error occurs we want sslErrors to be called, so the we can ignore it
	connect(&networkAccessManager, SIGNAL(sslErrors(QNetworkReply*, const QList<QSslError>&)),this,
	        SLOT(sslErrors(QNetworkReply*, const QList<QSslError>&)));

	connect(&networkAccessManager, SIGNAL(finished (QNetworkReply *)),
			this, SLOT(amfinished (QNetworkReply *) ) );

	connect(&networkAccessManager, SIGNAL(warning(const QString &)),
			this, SLOT(warning(const QString &)));

	networkAccessManager.setCookieJar(multiPageLoader.cookieJar);

	//If we must use a proxy, create a host of objects
	if (!settings.proxy.host.isEmpty()) {
		QNetworkProxy proxy;
		proxy.setHostName(settings.proxy.host);
		proxy.setPort(settings.proxy.port);
		proxy.setType(settings.proxy.type);
		// to retrieve a web page, it's not needed to use a fully transparent
		// http proxy. Moreover, the CONNECT() method is frequently disabled
		// by proxies administrators.
#if QT_VERSION >= 0x040500
		if (settings.proxy.type == QNetworkProxy::HttpProxy)
			proxy.setCapabilities(QNetworkProxy::CachingCapability);
#endif
		if (!settings.proxy.user.isEmpty())
			proxy.setUser(settings.proxy.user);
		if (!settings.proxy.password.isEmpty())
			proxy.setPassword(settings.proxy.password);
		networkAccessManager.setProxy(proxy);
	}

	webPage.setNetworkAccessManager(&networkAccessManager);
	webPage.mainFrame()->setZoomFactor(settings.zoomFactor);
}

/*!
 * Once loading starting, this is called
 */
void ResourceObject::loadStarted() {
	if (finished == true) {
		++multiPageLoader.loading;
		finished = false;
	}
	if (multiPageLoader.loadStartedEmitted) return;
	multiPageLoader.loadStartedEmitted=true;
	emit multiPageLoader.outer.loadStarted();
}


/*!
 * Called when the page is loading, display some progress to the using
 * \param progress the loading progress in percent
 */
void ResourceObject::loadProgress(int p) {
	//RR iframe crash
	// If we are finished, ignore this signal.
	if (finished || multiPageLoader.resources.size() <= 0) {
		return;
	}

	multiPageLoader.progressSum -= progress;
	progress = p;
	multiPageLoader.progressSum += progress;
	emit multiPageLoader.outer.loadProgress(multiPageLoader.progressSum / multiPageLoader.resources.size());
}

//RR load timeout
void ResourceObject::pageTimeout() {
		warning(QString("Timeout loading page")  + url.toString() );
		loadDone();
}


void ResourceObject::loadFinished(bool ok) {
	//RR iframe crash
	// If we are finished, this migth be a potential bug.
	if (finished || multiPageLoader.resources.size() <= 0) {
		return;
	}

	//RR iframe crop
	if(settings.localIframe)
	{
		if(!iframesProcessed)
		{
			iframesProcessed=true;
			bool found=false;
			QList<QWebFrame *> cropFrames=getCropFrames();
			iframeCount=cropFrames.count();
			loadCropFrames(cropFrames);
			if(iframeCount > 0) return;
		}
		else
		{
			iframeCount--;
			if(iframeCount > 0) return;

		}
	}

	multiPageLoader.hasError = multiPageLoader.hasError || (!ok && settings.loadErrorHandling == settings::LoadPage::abort);
	if (!ok) {
		if (settings.loadErrorHandling == settings::LoadPage::abort)
			error(QString("Failed loading page ") + url.toString() + " (sometimes it will work just to ignore this error with --load-error-handling ignore)");
		else if (settings.loadErrorHandling == settings::LoadPage::skip) {
			warning(QString("Failed loading page ") + url.toString() + " (skipped)");
			lo.skip = true;
		} else
			warning(QString("Failed loading page ") + url.toString() + " (ignored)");
	}

	// Evaluate extra user supplied javascript

	//RR
	bool isJSenabled=webPage.settings()->testAttribute(QWebSettings::JavascriptEnabled);
	if(!isJSenabled && !settings.runScript.isEmpty())
		webPage.settings()->setAttribute(QWebSettings::JavascriptEnabled, true);

	foreach (const QString & str, settings.runScript)
		webPage.mainFrame()->evaluateJavaScript(str);

	if(!isJSenabled && !settings.runScript.isEmpty())
		webPage.settings()->setAttribute(QWebSettings::JavascriptEnabled, isJSenabled);
/*
	QWebElementCollection ndImages=webPage.mainFrame()->findAllElements("img");

	foreach (QWebElement ndImage, ndImages) {
	     ndImage.setStyleProperty("page-break-inside","avoid");
	}
*/

/*
	if(!bFileLoaded && !settings.replaceBody.isEmpty())
	{
		QUrl orgUrl=webPage.mainFrame()->baseUrl();
		error(orgUrl.toString());
		//warning(QString(settings.replaceBody));
		bFileLoaded=true;
		//webPage.settings()->setAttribute(QWebSettings::JavascriptEnabled, false);
		QWebElement doc=webPage.mainFrame()->documentElement();
		QWebElement body=doc.findFirst("body");
		QWebElement p=body.parent();
		//body.setPlainText(QString(""));
		//body.removeAllChildren();
		//body.removeFromDocument();
		//p.appendInside(QString("<body>hallo</body>"));


		QFile file(settings.replaceBody);
		if(!file.open(QIODevice::ReadOnly)) {
			warning(QString("KANN IMPORTFILE NICHT ÖFFNEn"));
		}

		QTextStream in(&file);
		in.setCodec("UTF-8");
		QString line;
		while(!in.atEnd()) {
			line += in.readLine();

		}

		file.close();
		//body.appendInside(line);
		webPage.mainFrame()->setHtml(line,orgUrl);
		//webPage.settings()->setAttribute(QWebSettings::JavascriptEnabled, false);

	}
*/
	if (signalPrint || settings.jsdelay == 0) loadDone();
	else if (!settings.windowStatus.isEmpty()) waitWindowStatus();
	else QTimer::singleShot(settings.jsdelay, this, SLOT(loadDone()));

}

void ResourceObject::waitWindowStatus() {
	QString windowStatus = webPage.mainFrame()->evaluateJavaScript("window.status").toString();
	warning(QString("window.status:" + windowStatus + " settings.windowStatus:" + settings.windowStatus));
	if (windowStatus != settings.windowStatus) {
		QTimer::singleShot(50, this, SLOT(waitWindowStatus()));
	} else {
		QTimer::singleShot(settings.jsdelay, this, SLOT(loadDone()));
	}
}

void ResourceObject::printRequested(QWebFrame *) {
	signalPrint=true;
	loadDone();
}

void ResourceObject::loadDone() {
	if (finished) return;
	finished=true;

	//RR iframe crash
	// Ensure no more loading goes..
	webPage.triggerAction(QWebPage::Stop);
	webPage.triggerAction(QWebPage::StopScheduledPageRefresh);
	//networkAccessManager.dispose();



	--multiPageLoader.loading;
	if (multiPageLoader.loading == 0)
		multiPageLoader.loadDone();
}

/*!
 * Called when the page requires authentication, fills in the username
 * and password supplied on the command line
 */
void ResourceObject::handleAuthenticationRequired(QNetworkReply *reply, QAuthenticator *authenticator) {
	if (settings.username.isEmpty()) {
		//If no username is given, complain the such is required
		error("Authentication Required");
		reply->abort();
		multiPageLoader.fail();
	} else if (loginTry >= 2) {
		//If the login has failed a sufficient number of times,
		//the username or password must be wrong
		error("Invalid username or password");
		reply->abort();
		multiPageLoader.fail();
	} else {
		authenticator->setUser(settings.username);
		authenticator->setPassword(settings.password);
		++loginTry;
	}
}

void ResourceObject::warning(const QString & str) {
	emit multiPageLoader.outer.warning(str);
}

void ResourceObject::error(const QString & str) {
	emit multiPageLoader.outer.error(str);
}

/*!
 * Track and handle network errors
 * \param reply The networkreply that has finished
 */
void ResourceObject::amfinished(QNetworkReply * reply) {
	int errorCode = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
	if (errorCode > 399 && httpErrorCode == 0)
	{
		QFileInfo fi(reply->url().toString());
		bool mediaFile = settings::LoadPage::mediaFilesExtensions.contains(fi.completeSuffix().toLower());
		if ( ! mediaFile) {
			httpErrorCode = errorCode;
			return;
		}
		if (settings.mediaLoadErrorHandling == settings::LoadPage::abort)
		{
			httpErrorCode = errorCode;
			error(QString("Failed to load ") + reply->url().toString() + " (sometimes it will work just to ignore this error with --load-media-error-handling ignore)");
		}
		else {
			warning(QString("Failed to load %1 (%2)")
					.arg(reply->url().toString())
					.arg(settings::loadErrorHandlingToStr(settings.loadErrorHandling))
					);
		}
	}
}

/*!
 * Handle any ssl error by ignoring
 */
void ResourceObject::sslErrors(QNetworkReply *reply, const QList<QSslError> &) {
	//We ignore any ssl error, as it is next to impossible to send or receive
	//any private information with wkhtmltopdf anyhow, seeing as you cannot authenticate
	reply->ignoreSslErrors();
	//RR
	//warning("SSL error ignored");
}

void ResourceObject::load() {
	finished=false;
	++multiPageLoader.loading;
	bool hasFiles=false;
	foreach (const settings::PostItem & pi, settings.post) hasFiles |= pi.file;
	QByteArray postData;
	QString boundary;
	if (hasFiles) {
		boundary = QUuid::createUuid().toString().remove('-').remove('{').remove('}');
		foreach (const settings::PostItem & pi, settings.post) {
			//TODO escape values here
			postData.append("--");
			postData.append(boundary);
			postData.append("\ncontent-disposition: form-data; name=\"");
			postData.append(pi.name);
			postData.append('\"');
			if (pi.file) {
				QFile f(pi.value);
				if (!f.open(QIODevice::ReadOnly) ) {
					error(QString("Unable to open file ")+pi.value);
					multiPageLoader.fail();
				}
				postData.append("; filename=\"");
				postData.append( QFileInfo(pi.value).fileName());
				postData.append("\"\n\n");
				postData.append( f.readAll() );
				//TODO ADD MIME TYPE
			} else {
				postData.append("\n\n");
				postData.append(pi.value);
			}
			postData.append('\n');
		}
		if (!postData.isEmpty()) {
			postData.append("--");
			postData.append(boundary);
			postData.append("--\n");
		}
	} else {
		QUrl u;
		foreach (const settings::PostItem & pi, settings.post)
			u.addQueryItem(pi.name, pi.value);
		postData = u.encodedQuery();
	}


	typedef QPair<QString, QString> SSP;
 	foreach (const SSP & pair, settings.cookies)
		multiPageLoader.cookieJar->useCookie(url, pair.first, pair.second);

	QNetworkRequest r = QNetworkRequest(url);
	typedef QPair<QString, QString> HT;
	foreach (const HT & j, settings.customHeaders)
		r.setRawHeader(j.first.toAscii(), j.second.toAscii());
	//RR
	iframesProcessed=false;
	iframeCount=0;
	if (postData.isEmpty()){
		QUrl baseUrl=QUrl(r.url().toString(QUrl::RemoveQuery|QUrl::StripTrailingSlash),QUrl::TolerantMode);
		if(!settings.replaceBody.isEmpty() && baseUrl.isValid() && !multiPageLoader.outer.isHdrFooter)
		{
			url=baseUrl;
			bFileLoaded=true;

			QFile file(settings.replaceBody);
			if(!file.open(QIODevice::ReadOnly)) {
				warning(QString("KANN IMPORTFILE NICHT OEFFNEn"));
			}
			else
			{
				QTextStream in(&file);
				in.setCodec("UTF-8");
				QString line;
				while(!in.atEnd()) {
					line += in.readLine();

				}

				file.close();
				webPage.mainFrame()->setHtml(line,baseUrl);
			}
		}
		else
		{
			webPage.mainFrame()->load(r);
		}

	}
	else {
		if (hasFiles)
			r.setHeader(QNetworkRequest::ContentTypeHeader, QString("multipart/form-data, boundary=")+boundary);
		webPage.mainFrame()->load(r, QNetworkAccessManager::PostOperation, postData);
	}

	//RR

	if(settings.loadTimeout > 0)
	{
		QTimer::singleShot(settings.loadTimeout, this, SLOT(pageTimeout()));
	}

}

//RR crop Frames
QList<QWebFrame *> ResourceObject::getCropFrames(){
	QList<QWebFrame *> retVal;

	foreach(QWebFrame *piframe, webPage.mainFrame()->childFrames())
		if(piframe->frameName() == "pp2pdf-crop" && piframe->parentFrame() != NULL )
			retVal.append(piframe);

	return retVal;
}

void ResourceObject::loadCropFrames(QList<QWebFrame *> frames) {


	foreach(QWebFrame *piframe, frames)
	{
		QWebElement ndIframe=piframe->parentFrame()->findFirstElement("#pp2pdf-crop");
		if(!ndIframe.isNull() )
		{
			QUrl ifBaseUrl=QUrl(ndIframe.attribute("data-pp2pdf-base-url"),QUrl::TolerantMode);
			QFile file(ndIframe.attribute("data-pp2pdf-local-path"));
			if(!file.open(QIODevice::ReadOnly)) {
				warning(QString("KANN frame IMPORTFILE NICHT OEFFNEn"));
			}
			else
			{
				QTextStream in(&file);
				in.setCodec("UTF-8");
				QString line;
				while(!in.atEnd()) {
					line += in.readLine();

				}

				file.close();
				piframe->setHtml(line,ifBaseUrl);
			}

		}
		else
			iframeCount--;
	}
}

void MyCookieJar::useCookie(const QUrl &, const QString & name, const QString & value) {
	extraCookies.push_back(QNetworkCookie(name.toUtf8(), value.toUtf8()));
}

QList<QNetworkCookie> MyCookieJar::cookiesForUrl(const QUrl & url) const {
	QList<QNetworkCookie> list = QNetworkCookieJar::cookiesForUrl(url);
	list.append(extraCookies);
	return list;
}

void MyCookieJar::loadFromFile(const QString & path) {
	QFile cookieJar(path);
	if (cookieJar.open(QIODevice::ReadOnly | QIODevice::Text) )
		setAllCookies(QNetworkCookie::parseCookies(cookieJar.readAll()));
}

void MyCookieJar::saveToFile(const QString & path) {
	QFile cookieJar(path);
	if (cookieJar.open(QIODevice::WriteOnly | QIODevice::Text) )
		foreach (const QNetworkCookie & cookie, allCookies()) {
			cookieJar.write(cookie.toRawForm());
			cookieJar.write(";\n");
		}
}

void MultiPageLoaderPrivate::loadDone() {
	 if (!settings.cookieJar.isEmpty())
	 	cookieJar->saveToFile(settings.cookieJar);

	if (!finishedEmitted) {
		finishedEmitted = true;
		emit outer.loadFinished(!hasError);
	}
}



/*!
 * Copy a file from some place to another
 * \param src The source to copy from
 * \param dst The destination to copy to
 */
bool MultiPageLoader::copyFile(QFile & src, QFile & dst) {
//      TODO enable again when
//      http://bugreports.qt.nokia.com/browse/QTBUG-6894
//      is fixed
//      QByteArray buf(1024*1024*5,0);
//      while ( qint64 r=src.read(buf.data(),buf.size())) {
//          if (r == -1) return false;
//          if (dst.write(buf.data(),r) != r) return false;
//      }

    if (dst.write( src.readAll() ) == -1) return false;

	src.close();
	dst.close();
	return true;
}

MultiPageLoaderPrivate::MultiPageLoaderPrivate(const settings::LoadGlobal & s, MultiPageLoader & o):
	outer(o), settings(s) {

	cookieJar = new MyCookieJar();

	if (!settings.cookieJar.isEmpty())
	{
		cookieJar->loadFromFile(settings.cookieJar);
	}
}

MultiPageLoaderPrivate::~MultiPageLoaderPrivate() {
	clearResources();
}

LoaderObject * MultiPageLoaderPrivate::addResource(const QUrl & url, const settings::LoadPage & page) {
	ResourceObject * ro = new ResourceObject(*this, url, page);
	resources.push_back(ro);

	return &ro->lo;
}

void MultiPageLoaderPrivate::load() {
	progressSum=0;
	loadStartedEmitted=false;
	finishedEmitted=false;
	hasError=false;
	loading=0;

	for (int i=0; i < resources.size(); ++i)
		resources[i]->load();

	if (resources.size() == 0) loadDone();
}

void MultiPageLoaderPrivate::clearResources() {
	for (int i=0; i < resources.size(); ++i)
		delete resources[i];
	resources.clear();
	tempIn.remove();
}

void MultiPageLoaderPrivate::cancel() {
	//foreach (QWebPage * page, pages)
	//	page->triggerAction(QWebPage::Stop);
}

void MultiPageLoaderPrivate::fail() {
	hasError = true;
	cancel();
	clearResources();
}

/*!
  \brief Construct a multipage loader object, load settings read from the supplied settings
  \param s The settings to be used while loading pages
*/
//RR
MultiPageLoader::MultiPageLoader(settings::LoadGlobal & s):
	d(new MultiPageLoaderPrivate(s, *this)),isHdrFooter(false) {

}

MultiPageLoader::~MultiPageLoader() {
	delete d;
}

/*!
  \brief Add a resource, to be loaded described by a string
  @param string Url describing the resource to load
*/
LoaderObject * MultiPageLoader::addResource(const QString & string, const settings::LoadPage & s, const QString * data) {
	QString url=string;
	if (data && !data->isEmpty()) {
		url = d->tempIn.create(".html");
		QFile tmp(url);
		if (!tmp.open(QIODevice::WriteOnly) || tmp.write(data->toUtf8())==0) {
			emit error("Unable to create temporary file");
			return NULL;
		}
	} else if (url == "-") {
		QFile in;
		in.open(stdin,QIODevice::ReadOnly);
		url = d->tempIn.create(".html");
		QFile tmp(url);
		if (!tmp.open(QIODevice::WriteOnly) || !copyFile(in, tmp)) {
			emit error("Unable to create temporary file");
			return NULL;
		}
	}
	return addResource(guessUrlFromString(url), s);
}

/*!
  \brief Add a page to be loaded
  @param url Url of the page to load
*/
LoaderObject * MultiPageLoader::addResource(const QUrl & url, const settings::LoadPage & s) {
	return d->addResource(url, s);
}

/*!
  \brief Guess a url, by looking at a string

  (shamelessly copied from Arora Project)
  \param string The string the is suppose to be some kind of url
*/
QUrl MultiPageLoader::guessUrlFromString(const QString &string) {
	QString urlStr = string.trimmed();

	// check if the string is just a host with a port
	QRegExp hostWithPort(QLatin1String("^[a-zA-Z\\.]+\\:[0-9]*$"));
	if (hostWithPort.exactMatch(urlStr))
		urlStr = QLatin1String("http://") + urlStr;

	// Check if it looks like a qualified URL. Try parsing it and see.
	QRegExp test(QLatin1String("^[a-zA-Z]+\\://.*"));
	bool hasSchema = test.exactMatch(urlStr);
	if (hasSchema) {
		bool isAscii = true;
		foreach (const QChar &c, urlStr) {
			if (c >= 0x80) {
				isAscii = false;
				break;
			}
		}

		QUrl url;
		if (isAscii) {
			url = QUrl::fromEncoded(urlStr.toAscii(), QUrl::TolerantMode);
		} else {
			url = QUrl(urlStr, QUrl::TolerantMode);
		}
		if (url.isValid())
			return url;
	}

	// Might be a file.
	if (QFile::exists(urlStr)) {
		QFileInfo info(urlStr);
		return QUrl::fromLocalFile(info.absoluteFilePath());
	}

	// Might be a shorturl - try to detect the schema.
	if (!hasSchema) {
		int dotIndex = urlStr.indexOf(QLatin1Char('.'));
		if (dotIndex != -1) {
			QString prefix = urlStr.left(dotIndex).toLower();
			QString schema = (prefix == QLatin1String("ftp")) ? prefix : QLatin1String("http");
			QUrl url(schema + QLatin1String("://") + urlStr, QUrl::TolerantMode);
			if (url.isValid())
				return url;
		}
	}

	// Fall back to QUrl's own tolerant parser.
	QUrl url = QUrl(string, QUrl::TolerantMode);

	// finally for cases where the user just types in a hostname add http
	if (url.scheme().isEmpty())
		url = QUrl(QLatin1String("http://") + string, QUrl::TolerantMode);
	return url;
}

/*!
  \brief Return the most severe http error code returned during loading
 */
int MultiPageLoader::httpErrorCode() {
	int res=0;
	foreach (const ResourceObject * ro, d->resources)
		if (ro->httpErrorCode > res) res = ro->httpErrorCode;
	return res;
}

/*!
  \brief Begin loading all the resources added
*/
void MultiPageLoader::load() {
	d->load();
}

/*!
  \brief Clear all the resources
*/
void MultiPageLoader::clearResources() {
	d->clearResources();
}

/*!
  \brief Cancel the loading of the pages
*/
void MultiPageLoader::cancel() {
	d->cancel();
}

/*!
  \fn MultiPageLoader::loadFinished(bool ok)
  \brief Signal emitted when all pages have been loaded
  \param ok True if all the pages have been loaded sucessfully
*/

/*!
  \fn MultiPageLoader::loadProgress(int progress)
  \brief Signal emitted once load has progressed
  \param progress Progress in percent
*/

/*!
  \fn MultiPageLoader::loadStarted()
  \brief Signal emitted when loading has started
*/

/*!
  \fn void MultiPageLoader::warning(QString text)
  \brief Signal emitted when a none fatal warning has occured
  \param text A string describing the warning
*/

/*!
  \fn void MultiPageLoader::error(QString text)
  \brief Signal emitted when a fatal error has occured
  \param text A string describing the error
*/
}