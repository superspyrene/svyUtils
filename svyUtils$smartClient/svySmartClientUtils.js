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

 /**
  * @private
  *
 * @properties={typeid:24,uuid:"38714D53-CA5A-4E36-B1F0-F93EE01EFB61"}
 */
 function checkOperationSupported() {
 	if (!scopes.svySystem.isSwingClient()) {
 		throw new scopes.svyExceptions.UnsupportedOperationException('Only supported in Web Client')
 	}
 }

/**
 * Utility method to take off the wrapper on Servoy elements and access the underlying Java component
 * @private
 * @param {RuntimeComponent} element
 *
 * @return {Packages.javax.swing.JComponent}
 *
 * @properties={typeid:24,uuid:"EB054514-911B-477C-B060-FB1BB8C6367F"}
 */
function unwrapElement(element) {
	var list = new Packages.java.util.ArrayList();
	list.add(element)

	/**@type {Packages.javax.swing.JComponent}*/
	var unwrappedElement = list.get(0) 
	return unwrappedElement
}

/**
 * Utility method to get PluginAccess
 * @private
 * @return {Packages.com.servoy.j2db.smart.ISmartClientPluginAccess}
 * @SuppressWarnings(wrongparameters)
 *
 * @properties={typeid:24,uuid:"99ADF5CF-1C4D-4C30-B2E2-CE48138B0E74"}
 */
function getSmartClientPluginAccess() {
	//TODO: make this saver, in case the window plugin is not installed. Either just try the first plugin available or the plugins node itself or some other way and in all else fails, raise warnings
	var x = new Packages.org.mozilla.javascript.NativeJavaObject(globals, plugins.window, new Packages.org.mozilla.javascript.JavaMembers(globals, Packages.com.servoy.extensions.plugins.window.WindowProvider));
	return x['getClientPluginAccess']();
}

/**
 * @param {RuntimeComponent} element
 * @return {String}

 * @SuppressWarnings(wrongparameters)
 * @properties={typeid:24,uuid:"E5CD9513-415E-4F78-86CC-8ABD9EE07260"}
 */
function getFormName(element) {
	checkOperationSupported()
	var component = unwrapElement(element)
	
	/** @type {Packages.com.servoy.j2db.IFormUIInternal} */
	var parent = component.getParent()
	while (parent && !(parent instanceof Packages.com.servoy.j2db.IFormUIInternal)) {
		 parent = parent.getParent()
	}
	
	if (parent) {
		return parent.getFormContext().getValue(1,2).toString()
	}
	return null
}