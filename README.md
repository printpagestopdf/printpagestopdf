# printpagestopdf
This Project contains the necessary source for the Firefox AddOn "Print pages to Pdf". Because of strange differences with one guy from the Mozilla (AMO) Team new releases and Bugfixes of the AddOn couldn't be released.

This AddOn Version (0.5.0.5) was working fine up to Firefox Version 44.* and stopped working from FF 45 on.

Everybody who wants to go with Mozilla AMO Team to fix the problem for FF 45 and release the Addon feel free to use and change this source

The Addon is using the (modified) open Source library wkhtmltopdf that is based on QT 4.85

Directories:

printpagestopdf - The source of the Firefox Addon including a binary version of wkhtmltopdf DLL (wkhtmltox0.dll)

wkhtmltopdf_012_mod - The modifications of wkhtmltopdf.dll Version 12 (see project how to build)

qt_48_mod - The modifications of QT 4.85 to build the modified wkhtmltopdf0.dll above

Not longer available
