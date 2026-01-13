import type { Messages, SupportedLocale } from './types';

const baseMessages = {
  common: {
    appName: {
      en: 'Curtain Wizard',
      pl: 'Kreator Zasłon',
      uk: 'Майстер Штор',
    },
    design: {
      title: {
        en: 'Free design consultation',
        pl: 'Darmowa konsultacja projektowa',
        uk: 'Безкоштовна консультація дизайнера',
      },
      hint: {
        en: 'Open the consultation form to discuss fabric and style with our expert.',
        pl: 'Otwórz formularz konsultacji, aby omówić tkaniny i styl z ekspertem.',
        uk: 'Відкрийте форму консультації, щоб обговорити тканини та стиль з експертом.',
      },
      openNewTab: {
        en: 'Open in new tab',
        pl: 'Otwórz w nowej karcie',
        uk: 'Відкрити в новій вкладці',
      },
    },
    loading: {
      en: 'Loading…',
      pl: 'Ładowanie…',
      uk: 'Завантаження…',
    },
    yes: {
      en: 'Yes',
      pl: 'Tak',
      uk: 'Так',
    },
    no: {
      en: 'No',
      pl: 'Nie',
      uk: 'Ні',
    },
    back: {
      en: 'Back',
      pl: 'Wstecz',
      uk: 'Назад',
    },
    unit: {
      cm: {
        en: 'cm',
        pl: 'cm',
        uk: 'см',
      },
      m: {
        en: 'm',
        pl: 'm',
        uk: 'м',
      },
      percent: {
        en: '%',
        pl: '%',
        uk: '%',
      },
    },
  },
  home: {
    heading: {
      en: 'Curtain Wizard (BFF)',
      pl: 'Kreator Zasłon (BFF)',
      uk: 'Майстер Штор (BFF)',
    },
    intro: {
      en: 'Backend-in-Frontend scaffold is ready. Use /api/measure and /api/segment.',
      pl: 'Backend-in-Frontend jest gotowy. Użyj /api/measure oraz /api/segment.',
      uk: 'Backend-in-Frontend готовий. Використовуйте /api/measure та /api/segment.',
    },
    tryEstimatePrefix: {
      en: 'Try the',
      pl: 'Wypróbuj',
      uk: 'Спробуйте',
    },
    tryEstimate: {
      en: 'Curtain Wizard',
      pl: 'Kreator Zasłon',
      uk: 'Конфігуратор Штор',
    },
    tryEstimateMiddle: {
      en: 'or the',
      pl: 'albo',
      uk: 'або',
    },
    tryEstimateSuffix: {
      en: 'page.',
      pl: 'stronę.',
      uk: 'сторінку.',
    },
    segmentationDebug: {
      en: 'Segmentation Debug',
      pl: 'Debug Segmentacji',
      uk: 'Налагодження Сегментації',
    },
    configurator: {
      en: 'Configurator (Mask Overlay)',
      pl: 'Konfigurator (Nakładka Maski)',
      uk: 'Конфігуратор (Накладка Маски)',
    },
    tryConfiguratorPrefix: {
      en: 'New:',
      pl: 'Nowość:',
      uk: 'Нове:',
    },
  },
  estimate: {
    title: {
      en: 'Curtain Wizard',
      pl: 'Kreator Zasłon',
      uk: 'Конфігуратор Штор',
    },
    intro: {
      en: 'Upload your wall photo and create your dream curtains in just a few clicks!',
      pl: 'Prześlij zdjęcie ściany i stwórz swoje idealne zasłony w kilku kliknięciach!',
      uk: 'Завантажте фото стіни і створіть своїIdealні штори за кілька кліків!',
    },
    choosePhoto: {
      en: 'Choose Photo',
      pl: 'Wybierz zdjęcie',
      uk: 'Обрати фото',
    },
    tapToUpload: {
      en: 'Tap to upload or drop photo here',
      pl: 'Stuknij, aby wgrać lub upuść zdjęcie tutaj',
      uk: 'Торкніться, щоб завантажити або перетягніть фото сюди',
    },
    tapHint: {
      en: 'or open your camera app',
      pl: 'lub otwórz aplikację do zdjęć',
      uk: 'або відкрийте програму для фотографій',
    },
    providerLabel: {
      en: 'Provider:',
      pl: 'Dostawca:',
      uk: 'Постачальник:',
    },
    providerGoogle: {
      en: 'Google AI',
      pl: 'Google AI',
      uk: 'Google AI',
    },
    providerOpenai: {
      en: 'OpenAI',
      pl: 'OpenAI',
      uk: 'OpenAI',
    },
    providerLocalcv: {
      en: 'Local CV (FastAPI)',
      pl: 'Lokalny CV (FastAPI)',
      uk: 'Локальний CV (FastAPI)',
    },
    providerNoreref: {
      en: 'No reference (experimental)',
      pl: 'Bez referencji (eksperymentalne)',
      uk: 'Без еталону (експериментально)',
    },
    bypassCacheLabel: {
      en: 'Bypass local cache',
      pl: 'Pomiń lokalny cache',
      uk: 'Оминати локальний кеш',
    },
    modelPlaceholder: {
      en: 'Model',
      pl: 'Model',
      uk: 'Модель',
    },
    buttonEstimate: {
      en: 'Estimate Dimensions',
      pl: 'Oszacuj wymiary',
      uk: 'Оцінити розміри',
    },
    buttonEstimating: {
      en: 'Estimating…',
      pl: 'Szacowanie…',
      uk: 'Обчислення…',
    },
    buttonAnalyze: {
      en: 'Analyze photo',
      pl: 'Analizuj zdjęcie',
      uk: 'Аналізувати фото',
    },
    buttonAnalyzing: {
      en: 'Analyzing…',
      pl: 'Analizujemy…',
      uk: 'Аналізуємо…',
    },
    elapsed: {
      en: 'Elapsed: {time} ms',
      pl: 'Czas: {time} ms',
      uk: 'Минуло: {time} мс',
    },
    segElapsed: {
      en: 'Mask ready in {time} ms',
      pl: 'Maska gotowa w {time} ms',
      uk: 'Маску згенеровано за {time} мс',
    },
    loadingMagic: {
      en: 'Analysing your room with AI magic, stay tuned!',
      pl: 'Analizujemy pokój magią AI, chwilka cierpliwości!',
      uk: 'Аналізуємо кімнату магією ШІ, зачекайте!',
    },
    dropHere: {
      en: 'Drop image here',
      pl: 'Upuść obraz tutaj',
      uk: 'Перетягніть зображення сюди',
    },
    dropHint: {
      en: '…or paste from clipboard, or tap “Choose Photo” (uses camera on mobile).',
      pl: '…albo wklej ze schowka, lub wybierz „Wybierz zdjęcie” (na telefonie włącza aparat).',
      uk: '…або вставте зі буфера, чи натисніть «Обрати фото» (на мобільному відкриє камеру).',
    },
    menu: {
      camera: {
        en: 'Camera',
        pl: 'Aparat',
        uk: 'Камера',
      },
      upload: {
        en: 'Upload photo',
        pl: 'Wgraj zdjęcie',
        uk: 'Завантажити фото',
      },
    },
    resultTitle: {
      en: 'Estimated Wall Dimensions',
      pl: 'Szacowane wymiary ściany',
      uk: 'Оцінені розміри стіни',
    },
    resultWidth: {
      en: 'Width: {value} cm',
      pl: 'Szerokość: {value} cm',
      uk: 'Ширина: {value} см',
    },
    resultHeight: {
      en: 'Height: {value} cm',
      pl: 'Wysokość: {value} cm',
      uk: 'Висота: {value} см',
    },
    resultConfidence: {
      en: 'Confidence: {value}%',
      pl: 'Pewność: {value}%',
      uk: 'Впевненість: {value}%',
    },
    resultWarningsTitle: {
      en: 'Detector notes:',
      pl: 'Notatki detektora:',
      uk: 'Нотатки детектора:',
    },
    confirm: {
      title: {
        en: 'Check your wall size',
        pl: 'Sprawdź, czy wymiary się zgadzają',
        uk: 'Перевірте розміри стіни',
      },
      subtitle: {
        en: 'Our AI measured this wall for you. If your tape says something else, gently correct it here.',
        pl: 'AI policzyło ścianę za Ciebie. Jeśli miarka mówi co innego, popraw liczby poniżej.',
        uk: 'Наш ШІ оцінив стіну за вас. Якщо ваша рулетка каже інакше — виправте значення нижче.',
      },
      widthLabel: {
        en: 'Width (cm)',
        pl: 'Szerokość (cm)',
        uk: 'Ширина (см)',
      },
      heightLabel: {
        en: 'Height (cm)',
        pl: 'Wysokość (cm)',
        uk: 'Висота (см)',
      },
    confirmButton: {
      en: 'Go to configurator',
      pl: 'Przejdź do konfiguratora',
      uk: 'Перейти до конфігуратора',
    },
      waitSegmentation: {
        en: 'Hang tight—still generating the curtain mask.',
        pl: 'Chwila, maska wciąż się tworzy.',
        uk: 'Трішки терпіння — маска ще генерується.',
      },
      retrySegmentation: {
        en: 'Mask not ready. Please retry segmentation and try again.',
        pl: 'Maska nie jest gotowa. Uruchom segmentację ponownie i spróbuj jeszcze raz.',
        uk: 'Маска ще не готова. Запустіть сегментацію знову і повторіть спробу.',
      },
      rangeHint: {
        en: '50–1000 cm',
        pl: '50–1000 cm',
        uk: '50–1000 см',
      },
      error: {
        en: 'Enter valid positive numbers for width and height.',
        pl: 'Wpisz prawidłowe dodatnie liczby dla szerokości i wysokości.',
        uk: 'Введіть дійсні додатні числа для ширини та висоти.',
      },
    },
    toastTooLarge: {
      en: 'File too large. Max {max} MB',
      pl: 'Plik jest za duży. Maksymalnie {max} MB',
      uk: 'Файл надто великий. Максимум {max} МБ',
    },
    toastLoaded: {
      en: 'Photo loaded',
      pl: 'Zdjęcie wczytane',
      uk: 'Фото завантажено',
    },
    toastHeicConverted: {
      en: 'Converted HEIC photo to JPEG',
      pl: 'Przekonwertowano HEIC na JPEG',
      uk: 'Перетворено HEIC на JPEG',
    },
    heicConverting: {
      en: 'Converting HEIC…',
      pl: 'Konwertujemy HEIC…',
      uk: 'Перетворюємо HEIC…',
    },
    toastHeicFailed: {
      en: 'We couldn’t process the HEIC photo. Please try again.',
      pl: 'Nie udało się przetworzyć zdjęcia HEIC. Spróbuj ponownie.',
      uk: 'Не вдалося обробити фото HEIC. Спробуйте ще раз.',
    },
    toastPreviewFailed: {
      en: 'Failed to load image preview',
      pl: 'Nie udało się wczytać podglądu zdjęcia',
      uk: 'Не вдалося завантажити попередній перегляд фото',
    },
    toastWaitSegmentation: {
      en: 'Still preparing the wall mask. Give it a moment.',
      pl: 'Maska ściany wciąż się przygotowuje. Dajmy jej chwilę.',
      uk: 'Маска стіни ще готується. Зачекаймо трохи.',
    },
    toastNeedSegmentation: {
      en: 'Mask generation failed. Please retry segmentation before continuing.',
      pl: 'Nie udało się wygenerować maski. Uruchom segmentację ponownie przed kontynuacją.',
      uk: 'Не вдалося створити маску. Повторіть сегментацію перед продовженням.',
    },
    toastEstimated: {
      en: 'Estimated in {time} ms',
      pl: 'Oszacowano w {time} ms',
      uk: 'Оцінено за {time} мс',
    },
    toastFailed: {
      en: 'Estimation failed',
      pl: 'Oszacowanie nie powiodło się',
      uk: 'Не вдалося оцінити',
    },
    toastRetrying: {
      en: 'Taking another pass at {task} (attempt {attempt})…',
      pl: 'Próbujemy ponownie: {task} (podejście {attempt})…',
      uk: 'Повторюємо: {task} (спроба {attempt})…',
    },
    retryMeasurementLabel: {
      en: 'measurement',
      pl: 'pomiar',
      uk: 'вимірювання',
    },
    retrySegmentationLabel: {
      en: 'mask magic',
      pl: 'maskę',
      uk: 'маску',
    },
    measureError: {
      en: 'Measurement spell fizzled out. Please try again.',
      pl: 'Ups, pomiar się nie udał. Spróbuj ponownie.',
      uk: 'От халепа, вимірювання не вдалося. Спробуйте ще раз.',
    },
    segError: {
      en: 'Curtain mask spell fizzled out. Please try again.',
      pl: 'Ups, maska nie powstała. Spróbuj ponownie.',
      uk: 'Маску не вдалося створити. Спробуйте ще раз.',
    },
    retryMeasurementButton: {
      en: 'Retry measurement',
      pl: 'Ponów pomiar',
      uk: 'Повторити вимірювання',
    },
    retrySegmentationButton: {
      en: 'Retry mask',
      pl: 'Ponów generowanie maski',
      uk: 'Повторити маску',
    },
    toastReady: {
      en: 'Curtain lab is ready—opening the configurator!',
      pl: 'Konfigurator czeka — przenosimy Cię!',
      uk: 'Конфігуратор готовий — вирушаємо!',
    },
    polygon: {
      title: {
        en: 'Where will you hang your curtains?',
        pl: 'Gdzie powiesisz swoje zasłony?',
        uk: 'Где висунуться твої штори?',
      },
      subtitle: {
        en: 'Tap four corners and our AI will do the rest.',
        pl: 'Zaznacz cztery rogi a nasz AI zrobi pomiar.',
        uk: 'Позначте чотири кути й наш ШІ зробить все решту.',
      },
      hint: {
        en: 'Add four corners to enable measuring.',
        pl: 'Dodaj cztery rogi, aby włączyć pomiar.',
        uk: 'Додайте чотири кути, щоб увімкнути вимірювання.',
      },
      ready: {
        en: 'Corners set — hit measure to continue.',
        pl: 'Rogi zaznaczone — kliknij „Zmierz”.',
        uk: 'Кути позначено — натисніть «Виміряти».',
      },
      reset: {
        en: 'Reset area',
        pl: 'Resetuj obszar',
        uk: 'Скинути область',
      },
      cta: {
        en: 'Measure',
        pl: 'Zmierz',
        uk: 'Виміряти',
      },
      overlayHint: {
        en: 'Mark curtain area',
        pl: 'Zaznacz obszar zasłon',
        uk: 'Позначте зону штор',
      },
      confirmTitle: {
        en: 'Here it will hang!',
        pl: 'Tu będzie wisieć!',
        uk: 'Тут будуть висунутися!',
      },
      confirmSubtitle: {
        en: 'Confirm if this is correct, or mark again.',
        pl: 'Potwierdź, że wszystko się zgadza, albo zaznacz ponownie.',
        uk: 'Підтвердіть, що все правильно, або позначте ще раз.',
      },
      confirmAgain: {
        en: 'Mark again',
        pl: 'Zaznacz ponownie',
        uk: 'Позначити ще раз',
      },
      confirmAccept: {
        en: 'Measure',
        pl: 'Zmierz',
        uk: 'Виміряти',
      },
      errorIncomplete: {
        en: 'Mark all four corners before measuring.',
        pl: 'Zaznacz wszystkie cztery rogi przed pomiarem.',
        uk: 'Позначте всі чотири кути перед вимірюванням.',
      },
      errorNoPhoto: {
        en: 'Upload a photo first.',
        pl: 'Najpierw wgraj zdjęcie.',
        uk: 'Спершу завантажте фото.',
      },
    },
    previewAlt: {
      en: 'photo preview',
      pl: 'podgląd zdjęcia',
      uk: 'попередній перегляд фото',
    },
  },
  configure: {
    title: {
      en: 'Curtain Wizard',
      pl: 'Kreator Zasłon',
      uk: 'Конфігуратор Штор',
    },
    intro: {
      en: 'Create your dream curtains, send them to us, pay later!',
      pl: 'Stwórz swoje wymarzone zasłony, wyślij do nas, zapłać później!',
      uk: 'Створіть свій сонячний квіт, надішліть нам, заплатіть пізніше!',
    },
    welcome: {
      title: {
        en: '👋 Hello!',
        pl: '👋 Cześć!',
        uk: '👋 Ласкаво просимо!',
      },
      instructions: {
        en: '<strong>Configure panel on the right</strong> — choose your fabric and style',
        pl: '<strong>Panel konfiguracji po prawej</strong> — wybierz tkaninę i styl',
        uk: '<strong>Панель налаштувань справа</strong> — оберіть тканину та стиль',
      },
      adjust: {
        en: '<strong>Adjust curtains directly on the photo</strong> — drag to fit',
        pl: '<strong>Dostosuj zasłony bezpośrednio na zdjęciu</strong> — przeciągnij, aby dopasować',
        uk: '<strong>Налаштуйте штори безпосередньо на фото</strong> — перетягніть для підгонки',
      },
      summary: {
        en: '<strong>Summary below</strong> — see pricing and details',
        pl: '<strong>Podsumowanie poniżej</strong> — zobacz cenę i szczegóły',
        uk: '<strong>Підсумок нижче</strong> — перегляньте ціни та деталі',
      },
      screen: {
        en: '',
        pl: '',
        uk: '',
      },
      footer: {
        en: 'Happy shopping! 🛍️🎉',
        pl: 'Udanych zakupów! 🛍️🎉',
        uk: 'Дякуємо! 🛍️🎉',
      },
      gotIt: {
        en: 'Got it!',
        pl: 'Jasne!',
        uk: 'Зрозуміло!',
      },
    },
    controlsTitle: {
      en: 'Curtain Texture Controls',
      pl: 'Sterowanie Teksturą Zasłony',
      uk: 'Налаштування Текстури Штори',
    },
    segmenting: {
      en: 'Segmenting…',
      pl: 'Segmentacja…',
      uk: 'Сегментація…',
    },
    buttons: {
      choosePhoto: {
        en: 'Choose Photo',
        pl: 'Wybierz zdjęcie',
        uk: 'Обрати фото',
      },
      run: {
        en: 'Run Segmentation',
        pl: 'Uruchom segmentację',
        uk: 'Запустити сегментацію',
      },
      segmenting: {
        en: 'Segmenting…',
        pl: 'Segmentacja…',
        uk: 'Сегментація…',
      },
    },
    controls: {
      segments: {
        en: 'Segments',
        pl: 'Segmenty',
        uk: 'Сегменти',
      },
      segmentsLabel: {
        en: 'Segments: {count}',
        pl: 'Segmenty: {count}',
        uk: 'Сегменти: {count}',
      },
      segmentsInputLabel: {
        en: 'Set number of segments',
        pl: 'Ustaw liczbę segmentów',
        uk: 'Встановити кількість сегментів',
      },
      lightingAuto: {
        en: 'Auto lighting',
        pl: 'Automatyczne oświetlenie',
        uk: 'Автоматичне освітлення',
      },
      lightingStrength: {
        en: 'Lighting strength',
        pl: 'Siła oświetlenia',
        uk: 'Сила освітлення',
      },
      tileSize: {
        en: 'Curtain Width (per tile)',
        pl: 'Szerokość zasłony (na kafelek)',
        uk: 'Ширина штори (на плитку)',
      },
      tileSizeLabel: {
        en: 'Curtain width: {value}px',
        pl: 'Szerokość zasłony: {value}px',
        uk: 'Ширина штори: {value}px',
      },
      opacity: {
        en: 'Opacity',
        pl: 'Przezroczystość',
        uk: 'Непрозорість',
      },
      opacityLabel: {
        en: 'Opacity: {value}%',
        pl: 'Przezroczystość: {value}%',
        uk: 'Непрозорість: {value}%',
      },
      showMaskDebug: {
        en: 'Show mask (debug)',
        pl: 'Pokaż maskę (debug)',
        uk: 'Показати маску (debug)',
      },
    },
    addToCart: {
      en: 'Add to cart',
      pl: 'Dodaj do koszyka',
      uk: 'Додати до кошика',
    },
    getQuotation: {
      en: 'Get quotation',
      pl: 'Przejdź do wyceny',
      uk: 'Отримати кошторис',
    },
    adding: {
      en: 'Adding…',
      pl: 'Dodawanie…',
      uk: 'Додаємо…',
    },
    added: {
      en: 'Curtain config saved.',
      pl: 'Konfiguracja zapisana.',
      uk: 'Конфігурацію збережено.',
    },
    addedQuotation: {
      en: 'Quotation ready.',
      pl: 'Wycena gotow',
      uk: 'Кошторис готовий.',
    },
    configureAnother: {
      en: 'Configure another curtain',
      pl: 'Skonfiguruj kolejną zasłonę',
      uk: 'Налаштувати іншу штору',
    },
    finalizePurchase: {
      en: 'Finalize purchase',
      pl: 'Finalizuj zakup',
      uk: 'Завершити покупку',
    },
    redirectingToCart: {
      en: 'You will be redirected to cart in 5 seconds',
      pl: 'Za 5 sekund zostaniesz przekierowany do koszyka',
      uk: 'Ви будете перенаправлені до кошика через 5 секунд',
    },
    goToCart: {
      en: 'Go to cart',
      pl: 'Przejdź do koszyka',
      uk: 'Перейти до кошика',
    },
    exit: {
      buttonLabel: {
        en: 'Change photo',
        pl: 'Zmień zdjęcie',
        uk: 'Змінити фото',
      },
      title: {
        en: 'Leave configurator?',
        pl: 'Opuścić konfigurator?',
        uk: 'Вийти з конфігуратора?',
      },
      subtitle: {
        en: 'You will return to the photo selection step, and your current changes will be lost.',
        pl: 'Wrócisz do kroku z wyborem zdjęcia, obecne zmiany zostaną utracone.',
        uk: 'Ви повернетеся до кроку з фото, ваші зміни будуть втрачені.',
      },
      confirm: {
        en: 'Leave and choose new photo',
        pl: 'Opuść i wybierz nowe zdjęcie',
        uk: 'Вийти і обрати нове фото',
      },
      cancel: {
        en: 'Stay here',
        pl: 'Zostań tutaj',
        uk: 'Залишитися тут',
      },
    },
    missingCartUrl: {
      en: 'Set NEXT_PUBLIC_STOREFRONT_CART_URL for checkout link',
      pl: 'Ustaw NEXT_PUBLIC_STOREFRONT_CART_URL, aby włączyć odnośnik do koszyka',
      uk: 'Вкажіть NEXT_PUBLIC_STOREFRONT_CART_URL, щоб увімкнути посилання на кошик',
    },
    widthNotice: {
      en: 'This fabric choice is limited to {value}cm width.',
      pl: 'Ten materiał pozwala maksymalnie na szerokość {value} cm.',
      uk: 'Ця тканина обмежена шириною {value} см.',
    },
    heightNotice: {
      en: 'Curtain height limited to {value} cm for this fabric.',
      pl: 'Wysokość zasłony ograniczona do {value} cm dla tej tkaniny.',
      uk: 'Висоту штори обмежено до {value} см для цієї тканини.',
    },
    toastNotReady: {
      en: 'Pricing not ready yet. Please adjust a parameter and try again.',
      pl: 'Ceny jeszcze się ładują. Zmień parametr i spróbuj ponownie.',
      uk: 'Розрахунок ще триває. Змініть параметр і спробуйте знову.',
    },
    toastAdded: {
      en: 'Curtain configuration added to cart.',
      pl: 'Konfiguracja dodana do koszyka.',
      uk: 'Конфігурацію додано до кошика.',
    },
    toastStitchLines: {
      en: 'This is where we will seamlessly stitch your curtain.',
      pl: 'Tutaj bezszwowo zszyjemy Twoją zasłonę.',
      uk: 'Тут ми непомітно зшиємо вашу штору.',
    },
    toastFailed: {
      en: 'Failed to add to cart',
      pl: 'Nie udało się dodać do koszyka',
      uk: 'Не вдалося додати до кошика',
    },
    viewPayload: {
      en: 'View GraphQL payload',
      pl: 'Zobacz ładunek GraphQL',
      uk: 'Переглянути GraphQL-запит',
    },
    provider: {
      mock: {
        en: 'Provider: Debug catalog (mock)',
        pl: 'Dostawca: katalog testowy (mock)',
        uk: 'Постачальник: тестовий каталог (mock)',
      },
      storefront: {
        en: 'Provider: Magento storefront',
        pl: 'Dostawca: sklep Magento',
        uk: 'Постачальник: магазин Magento',
      },
    },
    serviceIncluded: {
      en: 'Included',
      pl: 'W cenie',
      uk: 'Входить у вартість',
    },
    services: {
      bookConsultation: {
        en: 'Book consultation',
        pl: 'Umów konsultację',
        uk: 'Записатися на консультацію',
      },
      catalog: {
        'svc-measure': {
          label: { en: 'Measurement Visit', pl: 'Wizyta pomiarowa', uk: 'Візит для вимірювання' },
          description: {
            en: 'Professional onsite measurement to guarantee fit.',
            pl: 'Profesjonalny pomiar na miejscu, aby zagwarantować dopasowanie.',
            uk: 'Професійні вимірювання на місці для ідеальної посадки.',
          },
        },
        'svc-install-waw': {
          label: { en: 'Pro Installation (Warsaw)', pl: 'Montaż profesjonalny (Warszawa)', uk: 'Професійний монтаж (Варшава)' },
          description: {
            en: 'Installation crew available within Warsaw city limits.',
            pl: 'Ekipa montażowa dostępna na terenie Warszawy.',
            uk: 'Бригада монтажників доступна на території Варшави.',
          },
        },
        'svc-rod-basic': {
          label: { en: 'Curtain Rod (Basic)', pl: 'Karnisz (Podstawowy)', uk: 'Карниз (Базовий)' },
          description: {
            en: 'Powder-coated rod with adjustable width and brackets.',
            pl: 'Karnisz malowany proszkowo z regulowaną szerokością i uchwytami.',
            uk: 'Порошково пофарбований карниз з регульованою шириною та кронштейнами.',
          },
        },
        'svc-stylist': {
          label: { en: 'Consult Stylist', pl: 'Konsultacja stylisty', uk: 'Консультація стиліста' },
          description: {
            en: 'Expert consultation on fabric selection and interior design.',
            pl: 'Konsultacja eksperta w zakresie wyboru tkanin i projektowania wnętrz.',
            uk: 'Експертна консультація з вибору тканин та дизайну інтер\'єру.',
          },
        },
      },
    },
    debug: {
      heading: {
        en: 'Debug UI',
        pl: 'Panel debugowania',
        uk: 'Панель налагодження',
      },
      save: {
        en: 'Save',
        pl: 'Zapisz',
        uk: 'Зберегти',
      },
      closeSave: {
        en: 'Close',
        pl: 'Zamknij',
        uk: 'Закрити',
      },
      show: {
        en: 'Show',
        pl: 'Pokaż',
        uk: 'Показати',
      },
      hide: {
        en: 'Hide',
        pl: 'Ukryj',
        uk: 'Приховати',
      },
      showStitchLines: {
        en: 'Show stitch lines',
        pl: 'Pokaż linie szycia',
        uk: 'Показати лінії швів',
      },
      handleBg: {
        en: 'Handle background',
        pl: 'Tło uchwytu',
        uk: 'Тло маркера',
      },
      borderColor: {
        en: 'Border color',
        pl: 'Kolor obramowania',
        uk: 'Колір обрамлення',
      },
      borderOpacity: {
        en: 'Border opacity',
        pl: 'Przezroczystość obramowania',
        uk: 'Непрозорість обрамлення',
      },
      handleOpacity: {
        en: 'Handle opacity',
        pl: 'Przezroczystość uchwytu',
        uk: 'Непрозорість маркера',
      },
      ringColor: {
        en: 'Ring color',
        pl: 'Kolor pierścienia',
        uk: 'Колір кільця',
      },
      ringOpacity: {
        en: 'Ring opacity',
        pl: 'Przezroczystość pierścienia',
        uk: 'Непрозорість кільця',
      },
      wallStroke: {
        en: 'Wall outline color',
        pl: 'Kolor obrysu ściany',
        uk: 'Колір контуру стіни',
      },
      wallStrokeOpacity: {
        en: 'Wall outline opacity',
        pl: 'Przezroczystość obrysu ściany',
        uk: 'Непрозорість контуру стіни',
      },
      weaveBlendMode: {
        en: 'Weave blend mode',
        pl: 'Tryb mieszania faktury',
        uk: 'Режим змішування фактури',
      },
      weaveBlendModeMultiply: {
        en: 'Multiply',
        pl: 'Mnożenie',
        uk: 'Множення',
      },
      weaveBlendModeOverlay: {
        en: 'Overlay',
        pl: 'Nakładka',
        uk: 'Накладання',
      },
      copyHint: {
        en: 'Copy this snippet into your `.env.local` (dev) or production env to apply these debug colors for everyone.',
        pl: 'Skopiuj ten fragment do `.env.local` (dev) lub do środowiska produkcyjnego, aby zastosować te kolory debugowania dla wszystkich.',
        uk: 'Скопіюйте цей фрагмент у файл `.env.local` (для dev) або у бойове середовище, щоб застосувати ці кольори налагодження для всіх.',
      },
      copy: {
        en: 'Copy snippet',
        pl: 'Skopiuj fragment',
        uk: 'Скопіювати фрагмент',
      },
    },
    updatingOptions: {
      en: 'Updating options…',
      pl: 'Aktualizowanie opcji…',
      uk: 'Оновлення параметрів…',
    },
    loadingOptions: {
      en: 'Loading catalog options…',
      pl: 'Ładowanie opcji katalogu…',
      uk: 'Завантаження параметрів каталогу…',
    },
    status: {
      elapsed: {
        en: 'Elapsed: {time} ms',
        pl: 'Czas: {time} ms',
        uk: 'Минуло: {time} мс',
      },
    },
    upload: {
      title: {
        en: 'Drop image here',
        pl: 'Upuść obraz tutaj',
        uk: 'Перетягніть зображення сюди',
      },
      hint: {
        en: '…or tap “{button}”, or paste from clipboard.',
        pl: '…albo kliknij „{button}”, lub wklej ze schowka.',
        uk: '…або натисніть «{button}», чи вставте з буфера.',
      },
      note: {
        en: 'Max {max}MB. JPG/PNG/HEIC supported.',
        pl: 'Maks {max}MB. Obsługiwane: JPG/PNG/HEIC.',
        uk: 'Макс {max}MB. Підтримуються JPG/PNG/HEIC.',
      },
      dropHere: {
        en: 'Drop image here',
        pl: 'Upuść obraz tutaj',
        uk: 'Перетягніть зображення сюди',
      },
      dropHint: {
        en: '…or tap “Choose Photo”, or paste from clipboard.',
        pl: '…albo kliknij „Wybierz zdjęcie”, lub wklej ze schowka.',
        uk: '…або натисніть «Обрати фото», чи вставте з буфера.',
      },
      dropNote: {
        en: 'Max {max}MB. JPG/PNG/HEIC supported.',
        pl: 'Maks {max}MB. Obsługiwane: JPG/PNG/HEIC.',
        uk: 'Макс {max}MB. Підтримуються JPG/PNG/HEIC.',
      },
      toastTooLarge: {
        en: 'File too large. Max {max} MB',
        pl: 'Plik jest za duży. Maksymalnie {max} MB',
        uk: 'Файл надто великий. Максимум {max} МБ',
      },
      toastLoaded: {
        en: 'Photo loaded',
        pl: 'Zdjęcie wczytane',
        uk: 'Фото завантажено',
      },
      toastCacheReadFailed: {
        en: 'Failed to read image for caching',
        pl: 'Nie udało się odczytać obrazu do cache',
        uk: 'Не вдалося прочитати зображення для кешування',
      },
    },
    overlay: {
      totalDimensions: {
        en: 'Curtain box: {width} {unit} × {height} {unit}',
        pl: 'Obszar zasłony: {width} {unit} × {height} {unit}',
        uk: 'Область штори: {width} {unit} × {height} {unit}',
      },
      segments: {
        en: 'Segments: {list}',
        pl: 'Segmenty: {list}',
        uk: 'Сегменти: {list}',
      },
    },
    progress: {
      preparing: {
        en: 'Preparing…',
        pl: 'Przygotowywanie…',
        uk: 'Підготовка…',
      },
      uploading: {
        en: 'Uploading…',
        pl: 'Przesyłanie…',
        uk: 'Вивантаження…',
      },
      uploadingPercent: {
        en: 'Uploading… {percent}%',
        pl: 'Przesyłanie… {percent}%',
        uk: 'Вивантаження… {percent}% ',
      },
      processing: {
        en: 'Sewing your curtains…',
        pl: 'Szyjemy Twoje zasłony…',
        uk: 'Готуємо попередній перегляд штор…',
      },
      waitingExisting: {
        en: 'Waiting on existing request…',
        pl: 'Oczekiwanie na istniejące żądanie…',
        uk: 'Очікування на наявний запит…',
      },
      keepTabOpen: {
        en: 'This will only take a moment.',
        pl: 'Jeszcze chwilka i za moment pokażemy zasłony.',
        uk: 'Це лише мить — зараз побачите штори.',
      },
      ariaLabel: {
        en: 'Segmentation progress',
        pl: 'Postęp segmentacji',
        uk: 'Хід сегментації',
      },
    },
    previewAlt: {
      en: 'Curtain preview',
      pl: 'Podgląd zasłony',
      uk: 'Попередній перегляд штор',
    },
    mark: {
      instruction: {
        en: 'Mark wall corners ({pos}).',
        pl: 'Zaznacz rogi ściany ({pos}).',
        uk: 'Позначте кути стіни ({pos}).',
      },
      done: {
        en: '4 corners marked.',
        pl: 'Zaznaczono 4 rogi.',
        uk: 'Позначено 4 кути.',
      },
      confirmed: {
        en: '4 corners marked.',
        pl: 'Zaznaczono 4 rogi.',
        uk: 'Позначено 4 кути.',
      },
      subtitle: {
        en: 'Confirm if this is correct, or mark again.',
        pl: 'Potwierdź, jeśli to jest prawidłowe, lub zaznacz ponownie.',
        uk: 'Підтвердіть, якщо це правильно, або позначте знову.',
      },
      again: {
        en: 'Mark again',
        pl: 'Zaznacz ponownie',
        uk: 'Позначити ще раз',
      },
      positions: {
        topLeft: {
          en: 'Top-Left',
          pl: 'Lewy-górny',
          uk: 'Верхній-лівий',
        },
        topRight: {
          en: 'Top-Right',
          pl: 'Prawy-górny',
          uk: 'Верхній-правий',
        },
        bottomRight: {
          en: 'Bottom-Right',
          pl: 'Prawy-dolny',
          uk: 'Нижній-правий',
        },
        bottomLeft: {
          en: 'Bottom-Left',
          pl: 'Lewy-dolny',
          uk: 'Нижній-лівий',
        },
      },
    },
    cache: {
      loaded: {
        en: 'Loaded cached segmentation.',
        pl: 'Wczytano wynik segmentacji z pamięci podręcznej.',
        uk: 'Завантажено сегментацію з кешу.',
      },
      offlineRestored: {
        en: 'Offline copy restored from cache.',
        pl: 'Przywrócono kopię offline z pamięci podręcznej.',
        uk: 'Офлайн-копію відновлено з кешу.',
      },
    },
    toastLoadedCached: {
      en: 'Loaded cached segmentation',
      pl: 'Wczytano wynik segmentacji z cache',
      uk: 'Завантажено сегментацію з кешу',
    },
    toastLoadedOffline: {
      en: 'Loaded offline mask from cache',
      pl: 'Wczytano maskę offline z cache',
      uk: 'Завантажено офлайн-маску з кешу',
    },
    toastSegFailed: {
      en: 'Segmentation failed',
      pl: 'Segmentacja nie powiodła się',
      uk: 'Сегментацію не виконано',
    },
    toastSegmentedElapsed: {
      en: 'Segmented in {time} ms',
      pl: 'Zsegmentowano w {time} ms',
      uk: 'Сегментовано за {time} мс',
    },
    errors: {
      loadCatalog: {
        en: 'Failed to load catalog data.',
        pl: 'Nie udało się wczytać danych katalogu.',
        uk: 'Не вдалося завантажити дані каталогу.',
      },
      loadFabrics: {
        en: 'Failed to load fabrics.',
        pl: 'Nie udało się wczytać tkanin.',
        uk: 'Не вдалося завантажити тканини.',
      },
      loadPleats: {
        en: 'Failed to load pleats.',
        pl: 'Nie udało się wczytać fałd.',
        uk: 'Не вдалося завантажити складки.',
      },
      loadHems: {
        en: 'Failed to load hems.',
        pl: 'Nie udało się wczytać podwinięć.',
        uk: 'Не вдалося завантажити підгини.',
      },
      catalog: {
        en: 'Failed to load catalog data.',
        pl: 'Nie udało się wczytać danych katalogu.',
        uk: 'Не вдалося завантажити дані каталогу.',
      },
      fabrics: {
        en: 'Failed to load fabrics.',
        pl: 'Nie udało się wczytać tkanin.',
        uk: 'Не вдалося завантажити тканини.',
      },
      pleats: {
        en: 'Failed to load pleats.',
        pl: 'Nie udało się wczytać fałd.',
        uk: 'Не вдалося завантажити складки.',
      },
      hems: {
        en: 'Failed to load hems.',
        pl: 'Nie udało się wczytać podwinięć.',
        uk: 'Не вдалося завантажити підгини.',
      },
      quote: {
        en: 'Unable to price configuration.',
        pl: 'Nie można wycenić konfiguracji.',
        uk: 'Не вдалося оцінити конфігурацію.',
      },
    },
    panel: {
      budget: {
        en: 'Budget',
        pl: 'Budżet',
        uk: 'Бюджет',
      },
      budgetPerMeter: {
        en: 'Budget per running metre',
        pl: 'Budżet za metr bieżący',
        uk: 'Бюджет за погонний метр',
      },
      fabricType: {
        en: 'Fabric Type',
        pl: 'Rodzaj tkaniny',
        uk: 'Тип тканини',
      },
      fabrics: {
        en: 'Fabrics',
        pl: 'Tkaniny',
        uk: 'Тканини',
      },
      color: {
        en: 'Color',
        pl: 'Kolor',
        uk: 'Колір',
      },
      pleating: {
        en: 'Pleating',
        pl: 'Fałdowanie',
        uk: 'Складки',
      },
      hem: {
        en: 'Hem',
        pl: 'Podwinięcie',
        uk: 'Підгин',
      },
      style: {
        en: 'Style',
        pl: 'Styl',
        uk: 'Стиль',
      },
      colorCategory: {
        en: 'Color',
        pl: 'Kolor',
        uk: 'Колір',
      },
      services: {
        en: 'Services',
        pl: 'Usługi',
        uk: 'Послуги',
      },
      noFabricsForBudget: {
        en: 'No fabrics match this filters. Try widening the filter.',
        pl: 'Brak tkanin o wybranych parametrach. Spróbuj zmienić filtry.',
        uk: 'Немає тканин з вибраними параметрами. Спробуйте змінити фільтри.',
      },
      patternPlain: {
        en: 'Plain',
        pl: 'Gładka',
        uk: 'Однотонна',
      },
      availableIn: {
        en: 'Available in {region}',
        pl: 'Dostępne w: {region}',
        uk: 'Доступно в: {region}',
      },
    },
    fabricTypes: {
      catalog: {
        all: {
          label: {
            en: 'All Fabrics',
            pl: 'Wszystkie tkaniny',
            uk: 'Усі тканини',
          },
          description: {
            en: 'Browse all fabric types',
            pl: 'Przeglądaj wszystkie rodzaje tkanin',
            uk: 'Переглянути всі типи тканин',
          },
        },
        'sheer-thin': {
          label: {
            en: 'Thin Sheer',
            pl: 'Cienka firana',
            uk: 'Легка тюль',
          },
          description: {
            en: 'Lightweight sheers that softly diffuse light.',
            pl: 'Lekkie firany, które delikatnie rozpraszają światło.',
            uk: 'Легка тюль, що м’яко розсіює світло.',
          },
        },
        'drape-thick': {
          label: {
            en: 'Thick Drape',
            pl: 'Gruba zasłona',
            uk: 'Щільна портьєра',
          },
          description: {
            en: 'Room-darkening drapes with luxurious texture.',
            pl: 'Zasłony zaciemniające o luksusowej fakturze.',
            uk: 'Щільні портьєри з розкішною фактурою, що затемнюють кімнату.',
          },
        },
        light: {
          label: { en: 'Light', pl: 'Light', uk: 'Легкі' },
          description: {
            en: 'Sheers and lightweight drapes that softly filter light.',
            pl: 'Firany i lekkie zasłony, które delikatnie filtrują światło.',
            uk: 'Легкі тюлі та портьєри, що м\'яко фільтрують світло.',
          },
        },
        heavy: {
          label: { en: 'Heavy', pl: 'Heavy', uk: 'Важкі' },
          description: {
            en: 'Room-darkening drapes with luxurious texture.',
            pl: 'Zasłony zaciemniające o luksusowej fakturze.',
            uk: 'Затемнюючі портьєри з розкішною фактурою.',
          },
        },
        blackout: {
          label: { en: 'Blackout', pl: 'Blackout', uk: 'Блекаут' },
          description: {
            en: 'Completely blocks light for maximum privacy and darkness.',
            pl: 'Całkowicie blokują światło dla maksymalnej prywatności i ciemności.',
            uk: 'Повністю блокують світло для максимальної приватності та темряви.',
          },
        },
      },
    },
    pleats: {
      catalog: {
        wave: { label: { en: 'Wave', pl: 'Wave', uk: 'Хвиля' } },
        flex: { label: { en: 'Flex', pl: 'Flex', uk: 'Флекс' } },
        ring: { label: { en: 'Ring', pl: 'Kółka', uk: 'Кільця' } },
        tunnel: { label: { en: 'Tunnel', pl: 'Tunel', uk: 'Тунель' } },
        tab: { label: { en: 'Tab', pl: 'Szelki', uk: 'Вкладки' } },
      },
    },
    styles: {
      all: { en: 'All Styles', pl: 'Wszystkie style', uk: 'Всі стилі' },
      basic: { en: 'Basic', pl: 'Basic', uk: 'Базовий' },
      natural: { en: 'Natural', pl: 'Natural', uk: 'Натуральний' },
      classic: { en: 'Classic', pl: 'Klasyczny', uk: 'Класичний' },
      modern: { en: 'Modern', pl: 'Nowoczesny', uk: 'Сучасний' },
      linen: { en: 'Linen', pl: 'Len', uk: 'Льон' },
      velvet: { en: 'Velvet', pl: 'Aksamit', uk: 'Оксамит' },
      sheer: { en: 'Sheer', pl: 'Firana', uk: 'Тюль' },
      patterned: { en: 'Patterned', pl: 'Wzorzyste', uk: 'З візерунком' },
      textured: { en: 'Textured', pl: 'Teksturowane', uk: 'Текстуровані' },
      decorative: { en: 'Decorative', pl: 'Dekoracyjne', uk: 'Декоративні' },
    },
    colorCategories: {
      all: { en: 'All Colors', pl: 'Wszystkie kolory', uk: 'Всі кольори' },
      bright: { en: 'Bright', pl: 'Jasne', uk: 'Світлі' },
      grey: { en: 'Grey', pl: 'Szare', uk: 'Сірі' },
      dark: { en: 'Dark', pl: 'Ciemne', uk: 'Темні' },
      colored: { en: 'Colored', pl: 'Kolorowe', uk: 'Кольорові' },
      patterned: { en: 'Patterned', pl: 'Wzorzyste', uk: 'З візерунком' },
      intensive: { en: 'Intensive', pl: 'Intensywne', uk: 'Intensivee' },
      natural: { en: 'Natural', pl: 'Naturalne', uk: 'Natural' },
      brown: { en: 'Brown', pl: 'Brązowe', uk: 'Brown' },
      cold: { en: 'Cold', pl: 'Chłodne', uk: 'Холодні' },
      warm: { en: 'Warm', pl: 'Ciepłe', uk: 'Теплі' },
      light: { en: 'Light', pl: 'Jasne', uk: 'Світлі' },
      cream: { en: 'Cream', pl: 'Kremowe', uk: 'Кремові' },
      neutral: { en: 'Neutral', pl: 'Neutralne', uk: 'Нейтральні' },
      cool: { en: 'Cool', pl: 'Chłodne', uk: 'Холодні' },
      black: { en: 'Black', pl: 'Czarne', uk: 'Чорні' },
      white: { en: 'White', pl: 'Białe', uk: 'Білі' },
      pastel: { en: 'Pastel', pl: 'Pastele', uk: 'Пастельні' },
    },
    totals: {
      totalDims: {
        en: 'Total Curtain Dimensions: {w} cm × {h} cm',
        pl: 'Całkowite wymiary zasłon: {w} cm × {h} cm',
        uk: 'Загальні розміри штор: {w} см × {h} см',
      },
      segments: {
        en: 'Segments: {segments}',
        pl: 'Segmenty: {segments}',
        uk: 'Сегменти: {segments}',
      },
    },
    budget: {
      any: {
        en: 'Any budget',
        pl: 'Dowolny budżet',
        uk: 'Будь-який бюджет',
      },
      anyPrice: {
        en: 'Any price',
        pl: 'Dowolna cena',
        uk: 'Будь-яка ціна',
      },
      perM: {
        en: '/m',
        pl: '/m',
        uk: '/м',
      },
      upToPerM: {
        en: 'Up to {price}/m',
        pl: 'Do {price}/m',
        uk: 'До {price}/м',
      },
      rangePerM: {
        en: '{min} – {max}/m',
        pl: '{min} – {max}/m',
        uk: '{min} – {max}/м',
      },
      highPerM: {
        en: '{min}+ /m',
        pl: '{min}+ /m',
        uk: '{min}+ /м',
      },
      sliderMin: {
        en: 'Min',
        pl: 'Min',
        uk: 'Мін',
      },
      sliderMax: {
        en: 'Max',
        pl: 'Maks',
        uk: 'Макс',
      },
      upToPerCm: {
        en: 'Up to {price}/cm',
        pl: 'Do {price}/cm',
        uk: 'До {price}/см',
      },
      rangePerCm: {
        en: '{min} – {max}/cm',
        pl: '{min} – {max}/cm',
        uk: '{min} – {max}/см',
      },
      highPerCm: {
        en: '{min}+ /cm',
        pl: '{min}+ /cm',
        uk: '{min}+ /см',
      },
    },
    summary: {
      title: {
        en: 'Summary',
        pl: 'Podsumowanie',
        uk: 'Підсумок',
      },
      details: {
        en: 'Details',
        pl: 'Szczegóły',
        uk: 'Деталі',
      },
      breakdown: {
        fabric: { en: 'Fabric', pl: 'Tkanina', uk: 'Тканина' },
        laborWithWidths: {
          en: 'Labor ({widths} widths)',
          pl: 'Robocizna ({widths} pasów)',
          uk: 'Робота ({widths} полотен)',
        },
        pleatSurcharge: { en: 'Pleat surcharge', pl: 'Dopłata za fałdę', uk: 'Надбавка за складки' },
        hemSurcharge: { en: 'Hem surcharge', pl: 'Dopłata za podwinięcie', uk: 'Надбавка за підгин' },
        fabricSurcharge: { en: 'Fabric surcharge', pl: 'Dopłata za tkaninę', uk: 'Надбавка за тканину' },
        total: { en: 'Total', pl: 'Razem', uk: 'Разом' },
      },
      optionsPricing: {
        en: 'Options & Pricing',
        pl: 'Opcje i ceny',
        uk: 'Опції та ціни',
      },
      fabric: {
        en: 'Fabric',
        pl: 'Tkanina',
        uk: 'Тканина',
      },
      viewFabricImage: {
        en: 'View fabric image',
        pl: 'Zobacz zdjęcie tkaniny',
        uk: 'Переглянути зображення тканини',
      },
      color: {
        en: 'Color',
        pl: 'Kolor',
        uk: 'Колір',
      },
      pleat: {
        en: 'Pleat',
        pl: 'Fałda',
        uk: 'Складка',
      },
      hem: {
        en: 'Hem',
        pl: 'Podwinięcie',
        uk: 'Підгин',
      },
      services: {
        en: 'Services',
        pl: 'Usługi',
        uk: 'Послуги',
      },
      servicesSelected: {
        en: '{count} selected',
        pl: 'Wybrane: {count}',
        uk: 'Обрано: {count}',
      },
      servicesNone: {
        en: 'None',
        pl: 'Brak',
        uk: 'Немає',
      },
      dimensions: {
        en: 'Dimensions',
        pl: 'Wymiary',
        uk: 'Розміри',
      },
      dimensionsDetail: {
        en: '{segments} segments: {widths}',
        pl: '{segments} segmentów: {widths}',
        uk: '{segments} сегментів: {widths}',
      },
      dimensionsSingle: {
        en: '{segments} segment: {width} {unit}',
        pl: '{segments} segment: {width} {unit}',
        uk: '{segments} сегмент: {width} {unit}',
      },
      height: {
        en: 'Height',
        pl: 'Wysokość',
        uk: 'Висота',
      },
      heightValue: {
        en: '{height} {unit}',
        pl: '{height} {unit}',
        uk: '{height} {unit}',
      },
      segmentWidths: {
        en: 'Segment Widths',
        pl: 'Szerokości segmentów',
        uk: 'Ширини сегментів',
      },
      cutDrop: {
        en: 'Cut Drop',
        pl: 'Długość cięcia',
        uk: 'Довжина різання',
      },
      cutDropValue: {
        en: '{value} {unit} (includes allowances)',
        pl: '{value} {unit} (z naddatkami)',
        uk: '{value} {unit} (з запасами)',
      },
      fabricOrdered: {
        en: 'Fabric Ordered',
        pl: 'Zamówiona tkanina',
        uk: 'Замовлено тканини',
      },
      boltWidths: {
        en: 'Bolt Widths Cut',
        pl: 'Liczba pasów z beli',
        uk: 'Кількість полотен з рулону',
      },
      boltWidthsOptimized: {
        en: '(optimized from {original})',
        pl: '(zoptymalizowano z {original})',
        uk: '(оптимізовано з {original})',
      },
      fullness: {
        en: 'Fullness',
        pl: 'Marszczenie',
        uk: 'Пишність',
      },
      fullnessValue: {
        en: '{value}',
        pl: '{value}',
        uk: '{value}',
      },
      shrinkage: {
        en: 'Shrinkage Allowance',
        pl: 'Zapasu na kurczliwość',
        uk: 'Запас на усадку',
      },
      shrinkageValue: {
        en: '{value}{unit}',
        pl: '{value}{unit}',
        uk: '{value}{unit}',
      },
      allowances: {
        en: 'Hem Allowances',
        pl: 'Zakładki na podwinięcie',
        uk: 'Запаси на підгин',
      },
      allowancesDetail: {
        en: '{total} cm (top {top}, bottom {bottom})',
        pl: '{total} cm (góra {top}, dół {bottom})',
        uk: '{total} см (верх {top}, низ {bottom})',
      },
      allowancesDetailFull: {
        en: 'top {top} cm, bottom {bottom} cm, sides {side} cm, stitch {stitch} cm',
        pl: 'góra {top} cm, dół {bottom} cm, boki {side} cm, szew {stitch} cm',
        uk: 'верх {top} см, низ {bottom} см, боки {side} см, шов {stitch} см',
      },
      repeat: {
        en: 'Pattern Repeat',
        pl: 'Raport wzoru',
        uk: 'Рапорт візерунку',
      },
      repeatDetail: {
        en: '{value} cm ({type})',
        pl: '{value} cm ({type})',
        uk: '{value} см ({type})',
      },
      repeatHalfDrop: {
        en: 'half-drop',
        pl: 'półraport',
        uk: 'піврапорт',
      },
      repeatStraight: {
        en: 'straight',
        pl: 'pełny',
        uk: 'повний',
      },
      widthsPerSegment: {
        en: 'Widths per Segment',
        pl: 'Pasów na segment',
        uk: 'Полотен на сегмент',
      },
      widthsPerSegmentValue: {
        en: '{value} width(s) sewn together',
        pl: '{value} pasów zszytych razem',
        uk: '{value} полотен зшито разом',
      },
      stitchLines: {
        en: 'Stitch lines visible in preview',
        pl: 'Linie szwów widoczne w podglądzie',
        uk: 'Лінії швів видимі в передпрогляді',
      },
      constraintWidth: {
        en: 'We trimmed panel width to fit the bolt.',
        pl: 'Przycięliśmy szerokość panelu, aby zmieścić się w beli.',
        uk: 'Ми зменшили ширину панелі, щоб поміститися на рулоні.',
      },
      constraintHeight: {
        en: 'We shortened the drop to stay within the fabric height.',
        pl: 'Skróciliśmy wysokość, aby zmieścić się w wysokości tkaniny.',
        uk: 'Ми зменшили довжину, щоб залишитися в межах висоти тканини.',
      },
    },
    coverageWarning: {
      title: {
        en: 'Incomplete wall coverage',
        pl: 'Niepełne pokrycie ściany',
        uk: 'Неповне покриття стіни',
      },
      message: {
        en: 'Your curtains currently cover only {coverage}% of the wall box. Are you sure you don\'t want to cover the entire wall?',
        pl: 'Twoje zasłony pokrywają obecnie tylko {coverage}% obszaru ściany. Czy na pewno nie chcesz pokryć całej ściany?',
        uk: 'Ваші штори наразі покривають лише {coverage}% стіни. Ви впевнені, що не хочете покрити всю стіну?',
      },
      addToCart: {
        en: 'Yes, get quotation',
        pl: 'Tak, przejdź do wyceny',
        uk: 'Так, отримати кошторис',
      },
      goBack: {
        en: 'Back to configurator',
        pl: 'Wróć do konfiguratora',
        uk: 'Повернутися до конфігуратора',
      },
    },
    instructions: {
      markCorners: {
        en: 'Mark the 4 wall corners to configure curtain options.',
        pl: 'Zaznacz 4 rogi ściany, aby skonfigurować opcje zasłony.',
        uk: 'Позначте 4 кути стіни, щоб налаштувати параметри штори.',
      },
    },
  },
  debugSeg: {
    title: {
      en: 'Segmentation Debug',
      pl: 'Debug Segmentacji',
      uk: 'Налагодження Сегментації',
    },
    intro: {
      en: 'Upload an image and preview mask/layers from /api/segment.',
      pl: 'Prześlij obraz i podglądaj maskę/warstwy z /api/segment.',
      uk: 'Завантажте зображення та перегляньте маску/шари з /api/segment.',
    },
    layers: {
      en: 'Layers',
      pl: 'Warstwy',
      uk: 'Шари',
    },
    run: {
      en: 'Run',
      pl: 'Uruchom',
      uk: 'Запустити',
    },
    running: {
      en: 'Running…',
      pl: 'Uruchamianie…',
      uk: 'Запуск…',
    },
    toastSegmentedElapsed: {
      en: 'Segmented in {time} ms',
      pl: 'Zsegmentowano w {time} ms',
      uk: 'Сегментовано за {time} мс',
    },
    timing: {
      en: 'Timing',
      pl: 'Czas',
      uk: 'Час',
    },
    elapsed: {
      en: 'Elapsed: {time} ms',
      pl: 'Czas: {time} ms',
      uk: 'Минуло: {time} мс',
    },
    finalMask: {
      en: 'final_mask',
      pl: 'final_mask',
      uk: 'final_mask',
    },
    attachedOnWall: {
      en: 'attached_on_wall',
      pl: 'attached_on_wall',
      uk: 'attached_on_wall',
    },
    proposalUnion: {
      en: 'proposal_union',
      pl: 'proposal_union',
      uk: 'proposal_union',
    },
    requestFailed: {
      en: 'Request failed',
      pl: 'Żądanie nie powiodło się',
      uk: 'Помилка запиту',
    },
    segFailed: {
      en: 'Segmentation failed',
      pl: 'Segmentacja nie powiodła się',
      uk: 'Сегментацію не виконано',
    },
  },
  language: {
    switcherLabel: {
      en: 'Language',
      pl: 'Język',
      uk: 'Мова',
    },
    polish: {
      en: 'Polish',
      pl: 'Polski',
      uk: 'Польська',
    },
    english: {
      en: 'English',
      pl: 'Angielski',
      uk: 'Англійська',
    },
    ukrainian: {
      en: 'Ukrainian',
      pl: 'Ukraiński',
      uk: 'Українська',
    },
  },
};

const locales: SupportedLocale[] = ['en', 'pl', 'uk'];

export const messages: Messages = locales.reduce((acc, locale) => {
  const build = (obj: any): any => {
    if (obj == null) return obj;
    if (typeof obj === 'string') return obj;
    if (Object.prototype.hasOwnProperty.call(obj, 'en')) {
      return obj[locale] ?? obj.en;
    }
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, build(value)]));
  };
  acc[locale] = build(baseMessages);
  return acc;
}, {} as Messages);

export const defaultLocale: SupportedLocale = 'pl';
