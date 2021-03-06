/*
 * This file is part of the Servoy Business Application Platform, Copyright (C) 2012-2013 Servoy BV 
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * TODO:
 * - Add option to stream blobs from Database to client, see https://www.servoy.com/forum/viewtopic.php?p=107753#p107753
 * - Add option to stream files from serverside filesystem to Web Client, see https://www.servoy.com/forum/viewtopic.php?p=107753#p107753
 */

/**
 * @private 
 *
 * @properties={typeid:35,uuid:"663420E6-0054-46C0-A328-5257365E0057",variableType:-4}
 */
var log = scopes.svyLogManager.getLogger('com.servoy.bap.utils.io')

/**
 * <pre>Opens a file from the file system using the default viewer for the fileType on the current platform. (.txt with editor, .pdf with pdf reader, .doc with word, etc.)
 * 
 * TODO: Support opening in the WC: either plugins.file.writeFile, but required to read the content first or showUrl, if file is accessible from the outside (see deprecated globals.svy_utl_open_file())
 * TODO: test Linux support: SampleCode suggests using xdg-open here: https://www.servoy.com/forum/viewtopic.php?f=15&t=15237&p=81646&hilit=application+getosname+and+linux#p81653
 * TODO param {String} [mimeType] Required for usage in the Web Client. Used by the browser to determine how to open the file
 * </pre> 
 * @param {plugins.file.JSFile|String} file The file that will be opened
 *
 * @properties={typeid:24,uuid:"95C45F79-F469-4542-BB8B-BE226010D8B1"}
 */
function openFileWithDefaultViewer(file) {
	if (!scopes.svySystem.isSwingClient()) {
		throw new scopes.svyExceptions.UnsupportedOperationException('Operation only supported in Smart or Runtime Client')
	}
	var osName = application.getOSName();
	/** @type {String} */
	var filePath = file;
	if (file instanceof plugins.file.JSFile) {
		filePath = file.getAbsolutePath();
	}
	if (/Windows/.test(osName)) {
		application.executeProgram('rundll32', ['url.dll,FileProtocolHandler', filePath]);
	} else if (/Linux|Freebsd/.test(osName)) {
		application.executeProgram('mozilla', [filePath]);
	} else if (/Mac/.test(osName)) {
		application.executeProgram('open', [filePath]);
	}
	//What if no match?
}

/**
 * Unzips the given file to the given target file<p>
 * 
 * If no target file is given, all files in fileToUnzip will<br>
 * be extracted to a directory with the same name as the zip file
 * 
 * @param {plugins.file.JSFile} fileToUnzip
 * @param {plugins.file.JSFile} [targetFile]
 * 
 * @return {plugins.file.JSFile} targetFile
 * 
 * @author patrick
 * @since 2012-10-15
 * 
 * @properties={typeid:24,uuid:"1453D732-A0CE-46B0-9EEE-81D656E61940"}
 */
function unzip(fileToUnzip, targetFile) {
	var zipFilePath = fileToUnzip.getAbsolutePath();
	var fileSeparator = java.io.File.separator;
	if (!targetFile) {
		targetFile = plugins.file.convertToJSFile(zipFilePath.substr(0, zipFilePath.lastIndexOf(".")));
		if (targetFile.exists()) {
			do {
				targetFile = plugins.file.convertToJSFile(targetFile.getAbsolutePath() + "-1");
			} while (targetFile.exists());
		}
	}
	
	if (!targetFile.exists()) {
		targetFile.mkdirs();
	}
	
	try {
		var zipFile = new java.util.zip.ZipFile(fileToUnzip.getAbsolutePath());
		var zipEntries = zipFile.entries();
		
		while (zipEntries.hasMoreElements()) {
			/** @type {java.util.zip.ZipEntry} */
			var zipEntry = zipEntries.nextElement();
			var zipEntryName = zipEntry.getName();
			zipEntryName = utils.stringReplace(zipEntryName, "/", java.io.File.separator);
			if (zipEntry.isDirectory()) {
				var zipDir = plugins.file.convertToJSFile(targetFile.getAbsolutePath() + fileSeparator + zipEntryName);
				zipDir.mkdirs();
				continue;
			} else {
				var jsFile = plugins.file.convertToJSFile(targetFile.getAbsolutePath() + fileSeparator + zipEntryName);
				if (!jsFile.getParentFile().exists()) {
					jsFile.getParentFile().mkdirs();
				}
				var is = zipFile.getInputStream(zipEntry);
				/** @type {java.io.OutputStream} */
				var fos = new java.io.FileOutputStream(jsFile.getAbsolutePath());
				
				/** @type {java.nio.channels.ReadableByteChannel} */
				var inputChannel = java.nio.channels.Channels.newChannel(is);
				/** @type {java.nio.channels.WritableByteChannel} */
				var outputChannel = java.nio.channels.Channels.newChannel(fos);		

				channelCopy(inputChannel, outputChannel);

				is.close();
				outputChannel.close();
				fos.close();
			}
		}
	} catch (e) {
		// IO Exception
		log.error("Failed to unzip file \"{}\": ", fileToUnzip.getAbsolutePath(), e.message);
		return null;
	}
	
	return targetFile;
}

/**
 * Zips the given file or directory<p>
 * 
 * The zip file will either be written to the given target file
 * or a zip file is created using the same name and location as the original file<p>
 * 
 * Note: if the target file already exists, it will be <b>deleted</b>
 * 
 * @param {plugins.file.JSFile} fileToZip
 * @param {plugins.file.JSFile} [targetFile]
 * @param {Array<String>} [filenamesToStoreUncompressed] array of file names that should be stored uncompressed in the archive
 * 
 * @return {plugins.file.JSFile} zipFile
 * 
 * @throws {Error}
 * 
 * @author patrick
 * @since 2012-10-15
 *
 * @properties={typeid:24,uuid:"9D6CECAE-ACD0-497F-9994-355861A2DE24"}
 */
function zip(fileToZip, targetFile, filenamesToStoreUncompressed) {
	var filePath = fileToZip.getAbsolutePath();
	if (!targetFile) {
		targetFile = plugins.file.convertToJSFile(filePath + ".zip");
	}
	
	if (targetFile.exists()) {
		if (!targetFile.deleteFile()) {
			return null;
		}
	}
	
	try {
		/** @type {java.util.zip.ZipOutputStream} */
		var zos = new java.util.zip.ZipOutputStream(new java.io.FileOutputStream(targetFile.getAbsolutePath()));
		
		/** @type {java.nio.channels.WritableByteChannel} */
		var outputChannel = java.nio.channels.Channels.newChannel(zos);		
		
		/**
		 * @param {plugins.file.JSFile} file
		 * @param {plugins.file.JSFile} base
		 * @param {java.util.zip.ZipOutputStream} zipOutputStream
		 */
		function zipFile(file, base, zipOutputStream) {
			if (file.isDirectory()) {
				var files = file.listFiles();
				for (var i = 0; i < files.length; i++) {
					var singleFile = files[i];
					zipFile(singleFile, base, zipOutputStream);
				}
				if (!files || files.length == 0) {
					// empty directory
					zipOutputStream.putNextEntry(new java.util.zip.ZipEntry(file.getPath().substring(base.getPath().length + 1) + "/"));
				}
			} else {
				/** @type {java.io.InputStream} */
				var is = new java.io.FileInputStream(file);
				var entryPath;
				if (file.getAbsolutePath() == base.getAbsolutePath()) {
					entryPath = file.getName();
				} else {
					entryPath = file.getPath().substring(base.getPath().length + 1);
				}
				entryPath = utils.stringReplace(entryPath, java.io.File.separator, "/");
				var entry = new java.util.zip.ZipEntry(entryPath);
				
				if (filenamesToStoreUncompressed && filenamesToStoreUncompressed.indexOf(file.getName()) != -1) {
					entry.setMethod(java.util.zip.ZipEntry.STORED);
					entry.setSize(file.size());
					var crc = new java.util.zip.CRC32();
					crc.update(file.getBytes());
					entry.setCrc(crc.getValue());
				}
				
				zipOutputStream.putNextEntry(entry);
				
				/** @type {java.nio.channels.ReadableByteChannel} */
				var inputChannel = java.nio.channels.Channels.newChannel(is);
				
				channelCopy(inputChannel, outputChannel);
				
				is.close();
			}
		}
			
		zipFile(fileToZip, fileToZip, zos);
		
		outputChannel.close();
		outputChannel = null;
		
		zos.close();
		zos = null;
	}
	catch(e) {
		log.error("Error zipping file \"{}\"", fileToZip.getAbsolutePath(), e);
		throw e;
	} finally {
		try {
			if (outputChannel != null) {
				outputChannel.close();
			}
			if (zos != null) {
				zos.close();
			}
		} catch(e) {
		}
	}
	
	return targetFile;
}

/**
 * Copies streams
 * 
 * @param {java.nio.channels.ReadableByteChannel} src
 * @param {java.nio.channels.WritableByteChannel} dest
 * 
 * @private 
 * 
 * @author patrick
 * @since 2012-10-15
 *
 * @properties={typeid:24,uuid:"8E3DD438-43FB-4499-A7B4-0D00F4956E90"}
 */
function channelCopy(src, dest) {
	var buffer = java.nio.ByteBuffer.allocateDirect(16 * 1024);
	while (src.read(buffer) != -1) {
		// prepare the buffer to be drained
		buffer.flip();
		// write to the channel, may block
		dest.write(buffer);
		// If partial transfer, shift remainder down
		// If buffer is empty, same as doing clear()
		buffer.compact();
	}
	// EOF will leave buffer in fill state
	buffer.flip();
	// make sure the buffer is fully drained.
	while (buffer.hasRemaining()) {
		dest.write(buffer);
	}

	src.close();
}

/**
 * @enum
 * @properties={typeid:35,uuid:"C217D4B1-1E19-439C-B056-8CE6D4C0C14F",variableType:-4}
 */
var CHAR_SETS = {
	/** Seven-bit ASCII, a.k.a. ISO646-US, a.k.a. the Basic Latin block of the Unicode character set.*/
	US_ASCII: 'US-ASCII',
	/**ISO Latin Alphabet No. 1, a.k.a. ISO-LATIN-1.*/
	ISO_8859_1: 'ISO-8859-1',
	/**Eight-bit Unicode Transformation Format.*/
	UTF_8: 'UTF-8',
	/**Sixteen-bit Unicode Transformation Format, big-endian byte order.*/
	UTF_16BE: 'UTF-16BE',
	/**Sixteen-bit Unicode Transformation Format, little-endian byte order.*/
	UTF_16LE: 'UTF-16LE',
	/**Sixteen-bit Unicode Transformation Format, byte order specified by a mandatory initial byte-order mark (either order accepted on input, big-endian used on output.)*/	
	UTF_16: 'UTF-16'
}

/**
 * Reads the content of a file line by line, without reading the entire file into memory
 * @param {plugins.file.JSFile} file
 * @param {Function} lineCallback function that gets called for each line. Receives the line content as first argument. Return false from the callback to stop further reading
 * @param {String} [charset] See {@link CHAR_SETS}. Default CHAR_SETS.UTF_8
 * 
 * @throws {IOException}
 * 
 * @example <pre>
 *  var file = plugins.file.convertToJSFile('C:/myCSVFile.csv')
 *  readFile(file, function(text) {
 *  	application.output(text)
 *  })
 * </pre>
 *
 * @properties={typeid:24,uuid:"B288B4EC-BC90-4ABA-9C2E-E45E600BF7D6"}
 */
function readFile(file, lineCallback, charset) {
	if (!file.exists() || file.isFile()) {
		throw new FileNotFoundException(null, file)
	}
    var fis = new Packages.java.io.FileInputStream(file);
    var isr = new Packages.java.io.InputStreamReader(fis, charset||CHAR_SETS.UTF_8);
    var br = new Packages.java.io.BufferedReader(isr);
    var line;
    try {
        while ((line = br.readLine())) {
            if(lineCallback(line) === false) {
            	break
            }
        }
     } catch (e) {
        throw new IOException('ERROR reading file "' + file.getName() + '": ' + e)
     } finally {
        br.close();
     	fis = null;
     	isr = null;
     	br = null;
     }
}

//TODO: add readXMLFile(...) according to this: https://www.servoy.com/forum/viewtopic.php?f=12&t=14666&sid=90df09038b66e906882586b6943681f7&p=105766#p105766

/**
 * @param {plugins.file.JSFile} file
 * @throws {IOException}
 * @return {Number} The number of lines in the file. -1 in case of an issue getting the number of lines in the file
 * @properties={typeid:24,uuid:"EEFD9AA1-68B5-4DD9-8C4D-AE0EE2488F28"}
 */
function getLineCountForFile(file) {
	if (!file.exists() || !file.isFile()) {
		throw new FileNotFoundException(null, file)
	}
	try {
		var fr = new Packages.java.io.FileReader(file);
		var lnr = new Packages.java.io.LineNumberReader(fr)
		while (lnr.readLine() != null) {
		}
	    return lnr.getLineNumber(); 
	} catch (e) {
        application.output('ERROR getting max lines for file "' + file.getName() + '": ' + e, LOGGINGLEVEL.ERROR);
	} finally {
		lnr.close();
		fr.close()
	}
	return -1
}

/**
 * Returns true if the given file is currently opened by the user
 * 
 * @param {plugins.file.JSFile} file
 * 
 * @author patick
 * @since 11.09.2012
 *
 * @properties={typeid:24,uuid:"61CAFF50-B7A8-499D-8008-4B8457A3E2F6"}
 */
function isFileOpen(file) {
	if (!file.exists() || file.isFile()) {
		throw new FileNotFoundException(null, file)
	}
	var result;
	if (scopes.svySystem.isWindowsPlatform()) {
		if (!file.canWrite()) {
			return true;
		}
		var originalfilePath = file.getAbsolutePath();
		var parentFolder = file.getParentFile().getAbsolutePath();
		var testFileName = application.getUUID().toString();
		var newName = parentFolder + "\\" + testFileName;
		var newFile = plugins.file.convertToJSFile(newName);
		result = file.renameTo(newName);
		if (result) {
			newFile.renameTo(originalfilePath);
			return false;
		} else {
			return true;
		}
	} else {
		//Unix
		result = application.executeProgram("lsof", [file.getAbsolutePath()]);
		if (result && result.length > 0) {
			return true;
		} else {
			return false;
		}
	}
}

/**
 * Creates a readable file size from the given number of bytes
 * 
 * @param {Number} size
 * @param {Number} [numberOfDigits]
 * 
 * @return {String} formattedFileSize
 *
 * @properties={typeid:24,uuid:"B6CB0207-DA2E-4EE7-88D7-7F66D39A6D6F"}
 */
function humanizeFileSize(size, numberOfDigits) {
	if (!size || size < 0) {
		return "0 bytes";
	}
	if (!numberOfDigits || numberOfDigits < 0) {
		numberOfDigits = 1;
	}
	if (size >= (1024*1024*1024*1024*1024)) {
		return utils.numberFormat(size/(1024*1024*1024*1024*1024), numberOfDigits) + " PB";
	} else if (size >= (1024*1024*1024*1024)) {
		return utils.numberFormat(size/(1024*1024*1024*1024), numberOfDigits) + " TB";
	} else if (size >= (1024*1024*1024)) {
		return utils.numberFormat(size/(1024*1024*1024), numberOfDigits) + " GB";		
	} else if (size >= (1024*1024)) {
		return utils.numberFormat(size/(1024*1024), numberOfDigits) + " MB";			
	} else if (size >= 1024) {
		return utils.numberFormat(size/1024, numberOfDigits) + " kB";		
	} else {
		return size + "bytes";
	}
}

/**
 * Raised for failed or interrupted I/O operations
 * 
 * @param {String} [errorMessage]
 * 
 * @constructor
 * @extends {scopes.svyExceptions.SvyException}
 * @author patrick
 *
 * @properties={typeid:24,uuid:"E0E2B56B-84B6-4A26-940A-A9EBB9F20CC3"}
 */
function IOException(errorMessage) {
	scopes.svyExceptions.SvyException.call(this, errorMessage||'IO Exception');
}

/**
 * The given file could not be found
 *
 * @param {String} [errorMessage]
 * @param {plugins.file.JSFile} [file]
 *
 * @constructor
 * @extends {IOException}
 * @properties={typeid:24,uuid:"9C109983-5E2B-4549-9431-E039E7CFACCD"}
 */
function FileNotFoundException(errorMessage, file) {

	/**
	 * The file that could not be found
	 * @type {plugins.file.JSFile}
	 */
	this.file = file;
	IOException.call(this, errorMessage||'File not found');
}

/**
 * Point prototypes to superclasses
 * @protected 
 *
 * @properties={typeid:35,uuid:"DAF325B1-1E2C-46A6-92C8-D4B2631B15E1",variableType:-4}
 */
var init = function() {
	IOException.prototype = Object.create(scopes.svyExceptions.SvyException.prototype);
	IOException.prototype.constructor = IOException
	
	FileNotFoundException.prototype = Object.create(IOException.prototype);
	FileNotFoundException.prototype.constructor = FileNotFoundException
}()

/**
 * @param {String} filePath
 * @param {String|JSDataSet} textToWrite
 * @param {Boolean} [append] optional default = true
 * @author Rene van Veen
 * TODO: add file writer stuff:
 * - https://www.servoy.com/forum/viewtopic.php?f=22&t=13866&p=72648&hilit=java.io.filewriter#p72637
 * - https://www.servoy.com/forum/viewtopic.php?t=6391
 * - Extend writing from DS for multi column
 * @properties={typeid:24,uuid:"8925E56D-8069-4975-99C9-AFCA04C37673"}
 */
function writeFile(filePath, textToWrite, append)
{
	try
	{
		var fileWriter = new Packages.java.io.FileWriter(filePath, append == undefined ? true : append)
		var buffedFileWriter = new Packages.java.io.BufferedWriter(fileWriter)
		
		if(textToWrite instanceof JSDataSet)
		{
			var max = textToWrite.getMaxRowIndex()
			for(var i = 1; i <= max; i++)
			{
				buffedFileWriter.write(textToWrite.getValue(i,1).toString())
				buffedFileWriter.newLine()
			}
		} else
		{
			buffedFileWriter.write(textToWrite.toString())
			buffedFileWriter.newLine()
		}
	} catch(e)
	{
		application.output('ERROR writing file "' + filePath + '": ' + e, LOGGINGLEVEL.ERROR);
	}finally
	{
		buffedFileWriter.flush()
		buffedFileWriter.close()
	}
}