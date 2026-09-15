import '@expo/metro-runtime';
import './global.css';
import * as WebBrowser from 'expo-web-browser';
import { registerRootComponent } from 'expo';
import App from './src/app/index';

WebBrowser.maybeCompleteAuthSession();

registerRootComponent(App);
