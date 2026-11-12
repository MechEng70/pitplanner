import { render } from 'preact';
import { App } from './app.tsx';
import { installRipple } from './ui/ripple.ts';
import './ui/ui.css';

installRipple();
render(<App />, document.getElementById('app')!);
