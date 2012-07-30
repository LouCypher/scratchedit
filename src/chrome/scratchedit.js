/* ***** BEGIN LICENSE BLOCK *****
* Version: MPL 1.1
*
* The contents of this file are subject to the Mozilla Public License Version
* 1.1 (the "License"); you may not use this file except in compliance with
* the License. You may obtain a copy of the License at
* http://www.mozilla.org/MPL/
*
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*
* Alternatively, the contents of this file may be used under the
* terms of the GNU General Public License Version 2 or later (the
* "GPL"), in which case the provisions of the GPL are applicable 
* instead of those above.
*
*
* The Original Code is the External Editor extension.
* The Initial Developer of the above Original Code is
* Philip Nilsson.
* Portions created by the Initial Developer are Copyright (C) 2005
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
* Kimitake
* Supported Japanese charaset and added ja-JP locale
*
* The Original Code is the MozEx extension.
* Copyright (C) 2003 Tomas Styblo <tripie@cpan.org>
*
* Contributor(s):
* - Alice0775, External Edittor for Custum Buttons
*              http://space.geocities.yahoo.co.jp/gl/alice0775
*              (2007/02/21)
* - LouCypher, external editor for Scratchpad
* 
* 
* ***** END LICENSE BLOCK ***** */

var scratchedit_tmpdir = null, scratchedit_dir_separator, scratchedit_os;
var scratchedit_ext, scratchedit_encode, scratchedit_target = [];

function scratchedit_editinit() {
  if (window.navigator.platform.toLowerCase().indexOf("win") != -1) {
    // Windows OS
    scratchedit_dir_separator = "\\";
    scratchedit_os = "win";
  } else {
    // UNIX/Linux OS
    scratchedit_dir_separator = "/";
    scratchedit_os = "unix";
  }

  scratchedit_ext = "js";
  scratchedit_encode = "UTF-8";
  scratchedit_target = [];

  window.addEventListener("unload", scratchedit_edituninit, false);
  window.addEventListener("unload", function() {
    document.removeEventListener("focus", scratchedit_checkfocus_window, true);
  }, false);
}

function scratchedit_getEditor() {
  var pref = Cc["@mozilla.org/preferences-service;1"].
             getService(Ci.nsIPrefService).
             getBranch("extensions.scratchedit.");
  var editor = pref.getCharPref("editor");
  if (!editor) {
    var prompts = Services.prompt;
    var ask = prompts.confirmEx(null, "Scratchpad Editor",
                                "Select external editor to use with Scratchpad",
                                prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING
                              + prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_CANCEL
                              + prompts.BUTTON_POS_2 * prompts.BUTTON_TITLE_IS_STRING,
                                "Continue", "", "", null, {value: false});
    if (ask != 0) return;
    var nsIFilePicker = Ci.nsIFilePicker;
    var filePicker = Cc["@mozilla.org/filepicker;1"].
                     createInstance(nsIFilePicker);
    filePicker.init(window, "Select editor", nsIFilePicker.modeOpen);
    filePicker.appendFilters(nsIFilePicker.filterApplication);
    filePicker.appendFilters(nsIFilePicker.filterAll);
    if (filePicker.show() == nsIFilePicker.returnOK) {
      if (filePicker.file.exists() && filePicker.file.isExecutable()) {
        pref.setCharPref("editor", filePicker.file.path);
        editor = filePicker.file.path;
      }
    }
  }
  return editor;
}

function scratchedit_edituninit() {
  if (scratchedit_tmpdir == null) return;
  var windowType = "navigator:browser";
  var windowManager = Cc["@mozilla.org/appshell/window-mediator;1"].
                      getService();
  var windowManagerInterface = windowManager.
                               QueryInterface(Ci.nsIWindowMediator);
  var enumerator = windowManagerInterface.getEnumerator(windowType);
  if (enumerator.hasMoreElements()) {
    return;
  }

  var file = Cc["@mozilla.org/file/local;1"].
             createInstance(Ci.nsILocalFile);
  file.initWithPath(scratchedit_tmpdir);
  var entries = file.directoryEntries;
  while (entries.hasMoreElements()) {
    var entry = entries.getNext().QueryInterface(Ci.nsIFile);
    if (/^scratchpad\./i.test(entry.leafName)) {
      try {
        entry.remove(false);
      } catch(e) {
      }
    }
  }

  try {
    if (file.exists() == true ) {
      file.remove(false);
    }
  } catch(e) {
  }

  scratchedit_tmpdir = null;
}

function scratchedit_menu() {
  scratchedit_edittarget(document.getElementById("scratchpad-editor"));
}

function scratchedit_checkfocus_window() {
  var target, filename, timestamp, encode,
      file, inst, sstream, utf, textBoxText;

  if (scratchedit_target.length <= 0) return;

  file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  istr = Cc["@mozilla.org/network/file-input-stream;1"].
         createInstance(Ci.nsIFileInputStream);

  // FileInputStream's read is [noscript].
  sstream = Cc["@mozilla.org/scriptableinputstream;1"].
            createInstance(Ci.nsIScriptableInputStream);
  utf = Cc["@mozilla.org/intl/utf8converterservice;1"].
        createInstance(Ci.nsIUTF8ConverterService);

  for (var i = 0; i < scratchedit_target.length;i++) {
    target = scratchedit_target[i];
    if (!target.hasAttribute("filename")) continue;
    filename = target.getAttribute("filename");
    timestamp = target.getAttribute("timestamp");
    file.initWithPath(filename);
    if (!file.exists() || !file.isReadable()) continue;
    if (file.lastModifiedTime <= timestamp) continue;

    target.setAttribute("timestamp", file.lastModifiedTime);

    istr.init(file, 1, 0x400, false);
    sstream.init(istr);

    textBoxText = sstream.read(sstream.available());
    textBoxText = textBoxText.replace(/\r\n/g, "\n");
    encode = target.getAttribute("encode");
    if (textBoxText.length) {
      //target.value = utf.convertStringToUTF8(textBoxText, encode, true);
      Scratchpad.setText(utf.convertStringToUTF8(textBoxText, encode, true, true));
    } else {
      //target.value = "";
      Scratchpad.setText("");
    }
    sstream.close();
    istr.close();
    try {
      file.remove(false);
    } catch(e) {
    }
  }
}

function scratchedit_editfile(target, filename) {
  // Figure out what editor to use.
  var editor = scratchedit_getEditor();
  if (!editor) return false;

  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  file.initWithPath(editor);
  if (!file.exists()) {
    alert("Error_invalid_Editor_file");
    return false;
  }
  if (!file.isExecutable()) {
    alert("Please pick an executable application.");
    return false;
  }
  target.setAttribute("filename", filename);
  target.setAttribute("timestamp", file.lastModifiedTime);

  // Run the editor.
  var process = Cc["@mozilla.org/process/util;1"].
                createInstance(Ci.nsIProcess);
  process.init(file);
  var args = [filename];
  process.run(false, args, args.length);  // don't block
  document.addEventListener("focus", scratchedit_checkfocus_window, true);
  return true;
}

function scratchedit_edittarget(target) {
  var textBoxText = Scratchpad.getText();
  // Get filename.
  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  if (target.hasAttribute("filename")) {
    var filename = target.getAttribute("filename");
    file.initWithPath(filename);
    try {
      if(file.exists()) file.remove(false);
    } catch(e) {
    }
  } else {
    var filename = scratchedit_TmpFilenameTextarea();
  }
  file.initWithPath(filename);    
  file.create(file.NORMAL_FILE_TYPE, 0600);

  // Write the data to the file.
  var ostr = Cc["@mozilla.org/network/file-output-stream;1"].
             createInstance(Ci.nsIFileOutputStream);
  ostr.init(file, 2, 0x200, false);

  if(navigator.platform == "Win32") {
    // Convert Unix newlines to standard network newlines
    textBoxText = textBoxText.replace(/\n/g, "\r\n");
  }
  var conv = Cc["@mozilla.org/intl/saveascharset;1"].
             createInstance(Ci.nsISaveAsCharset);
  try {
    conv.Init(scratchedit_encode, 0, 0);
    textBoxText = conv.Convert(textBoxText);
  } catch(e) {
    textBoxText = "";
  }
  ostr.write(textBoxText, textBoxText.length);

  ostr.flush();
  ostr.close();

  // setup target info
  target.setAttribute("encode", scratchedit_encode);

  // Edit the file.
  if (scratchedit_editfile(target, file.path)) {
    scratchedit_target.push(target);  // Editting target array
  }
}

//Compose temporary filename out of
//    - tmpdir setting
//    - document url
//    - textarea name
//    - ext suffix
function scratchedit_TmpFilenameTextarea() {
  var TmpFilename;
  scratchedit_tmpdir = scratchedit_gettmpDir();
  do {
    TmpFilename = scratchedit_tmpdir + scratchedit_dir_separator + "scratchpad." +
                  Math.floor(Math.random() * 100000) + "." + scratchedit_ext;
  } while (!scratchedit_ExistsFile(TmpFilename))
    return TmpFilename;
}

//Function returns true if given filename exists
function scratchedit_ExistsFile(filename) {
  try {
    var file = Cc["@mozilla.org/file/local;1"].
               createInstance(Ci.nsILocalFile);
    file.initWithPath(filename);
    return true;
  } catch(e) {
    return false;
  }
}

/**
* Returns the directory where we put files to edit.
* @returns nsILocalFile The location where we should write editable files.
*/
function scratchedit_gettmpDir() {
  /* Where is the directory that we use. */
  var fobj = Cc["@mozilla.org/file/directory_service;1"].
             getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
  fobj.append("Temp_ScratchEdit");
  if (!fobj.exists()) {
    fobj.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt("0700", 8));
  }
  if (!fobj.isDirectory()) {
    // the string will be replaced locale properties in the future
    alert("Having a problem finding or creating directory: " + fobj.path);
  }
  return fobj.path;
}

window.addEventListener("load", scratchedit_editinit, false);
window.removeEventListener("unload", scratchedit_editinit, false);