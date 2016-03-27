<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet version="2.0"

                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"

                xmlns:outline="http://code.google.com/p/wkhtmltopdf/outline"

                xmlns="http://www.w3.org/1999/xhtml">

  <xsl:output doctype-public="-//W3C//DTD HTML 4.01 Transitional//EN"

              doctype-system="http://www.w3.org/TR/html4/loose.dtd"
				method="html" 
				version="4.0"
				encoding="UTF-8"
              indent="yes" />

			  
	<xsl:variable name="inhalt" select="substring-after(//outline:item[contains(@title,'__printPages2Pdf__Prefix__')]/@title,'__printPages2Pdf__Prefix__')"/>
  <xsl:template match="outline:outline">
    <html>

      <head>
		<xsl:if test="$inhalt">
			<title>
				<xsl:value-of select="$inhalt" />
			</title>
		</xsl:if>
        <style>
		  div[istitle]{
			display: block;
			margin-top: 1em;
			border-bottom: none;
			font-weight:bold;
		  }

		  div[isinhalt]{
			display: block;
			margin-top: 1em;
			font-weight:bold;
		  }
		  
		  
          div[header] {

            text-align: center;

            font-size: 20px;

            font-family: arial;
			border:none;

          }

          div {border-bottom: 1px dashed rgb(200,200,200);}

          span {float: right;}

          li {list-style: none;}

          ul {

            font-size: 20px;

            font-family: arial;

          }

          ul ul {font-size: 90%; }

          ul {padding-left: 0em;}

          ul ul {padding-left: 1em;}

          a {text-decoration:none; color: black;}

        </style>

      </head>

      <body>

		<xsl:if test="$inhalt">
			<div header="true">
				<xsl:value-of select="$inhalt" />
			</div>
		</xsl:if>

        <ul>
<!--			<xsl:if test="$inhalt">
				<li><div><xsl:value-of select="$inhalt" /><span>1</span></div></li>
			</xsl:if>-->
<!--			<xsl:apply-templates select="outline:item/outline:item"/>-->
			<xsl:apply-templates select="/outline:outline/outline:item"/>
		</ul>

      </body>

    </html>

  </xsl:template>

  <xsl:template match="/outline:outline/outline:item">
    <ul>
		<li>
		  <xsl:if test="@title!=''">
			<xsl:choose>

				<xsl:when test="contains(@title,'__printPages2Pdf__Prefix__')">
					<xsl:if test="@page > 0">
					<div isinhalt="true">
						<xsl:value-of select="$inhalt" /> 
						<span> <xsl:value-of select="@page + 1" /> </span>
					</div>
					</xsl:if>
				</xsl:when>
				<xsl:otherwise>
				<div istitle="true">
					<xsl:value-of select="@title" /> 
				</div>
				</xsl:otherwise>
			</xsl:choose>
		  </xsl:if>
			<xsl:apply-templates select="outline:item"/>
		</li>
    </ul>

  </xsl:template>

 <xsl:template match="outline:item/outline:item">
    <ul>
		<li>
		  <xsl:if test="@title!=''">

			<div>

			  <a>

				<xsl:if test="@link">

				  <xsl:attribute name="href"><xsl:value-of select="@link"/></xsl:attribute>

				</xsl:if>

				<xsl:if test="@backLink">

				  <xsl:attribute name="name"><xsl:value-of select="@backLink"/></xsl:attribute>

				</xsl:if>

				<xsl:value-of select="@title" /> 

			  </a>

			  <span> <xsl:value-of select="@page" /> </span>

			</div>

		  </xsl:if>
			<xsl:apply-templates select="outline:item"/>
		</li>
    </ul>

  </xsl:template>

</xsl:stylesheet>

