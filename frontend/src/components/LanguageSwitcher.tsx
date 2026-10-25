import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';

// Floating language switcher shown on every page. Uses Google's website
// translation engine behind our own button, so all pages (public, customer,
// admin) are translated without rewriting any text.

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
];

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

function getCurrentLang(): string {
  try {
    const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
    return m ? decodeURIComponent(m[1]) : 'en';
  } catch {
    return 'en';
  }
}

function clearTranslateCookie() {
  const host = window.location.hostname;
  const expire = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
  document.cookie = expire;
  document.cookie = `${expire}; domain=${host}`;
  document.cookie = `${expire}; domain=.${host}`;
}

// Google's translator rewrites text nodes, which can make React throw
// "removeChild/insertBefore" errors on later renders. This is the standard
// guard: ignore the call when the node was already moved by the translator.
let patched = false;
function patchDomForTranslator() {
  if (patched || typeof Node === 'undefined') return;
  patched = true;
  const origRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return origRemove.call(this, child) as T;
  };
  const origInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return newNode;
    return origInsert.call(this, newNode, ref) as T;
  };
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    patchDomForTranslator();
    setLang(getCurrentLang());

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate) return;
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: LANGUAGES.map((l) => l.code).join(','),
          autoDisplay: false,
        },
        'google_translate_element'
      );
    };

    if (!document.getElementById('google-translate-script')) {
      const s = document.createElement('script');
      s.id = 'google-translate-script';
      s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // close the menu when clicking elsewhere
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function choose(code: string) {
    setOpen(false);
    if (code === lang) return;

    if (code === 'en') {
      // back to the original language
      clearTranslateCookie();
      window.location.reload();
      return;
    }

    const combo = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
    if (combo) {
      combo.value = code;
      combo.dispatchEvent(new Event('change'));
      setLang(code);
    } else {
      // translator not loaded yet (slow network / blocked) — set the cookie and reload
      document.cookie = `googtrans=/en/${code}; path=/`;
      window.location.reload();
    }
  }

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <>
      {/* hidden host element the Google engine attaches to */}
      <div id="google_translate_element" style={{ display: 'none' }} />

      <div ref={boxRef} translate="no" className="notranslate fixed bottom-4 left-4 z-[60]">
        {open && (
          <div
            role="listbox"
            aria-label="Choose language"
            className="mb-2 max-h-72 w-48 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={l.code === lang}
                onClick={() => choose(l.code)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span>{l.label}</span>
                {l.code === lang && <Check size={14} className="text-green-600" />}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Change language"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50"
        >
          <Globe size={16} />
          <span>{current.label}</span>
        </button>
      </div>
    </>
  );
}
