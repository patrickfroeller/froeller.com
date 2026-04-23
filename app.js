(() => {
  function srgbToLinear(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }

  function getRelativeLuminance({ r, g, b }) {
    const red = srgbToLinear(r);
    const green = srgbToLinear(g);
    const blue = srgbToLinear(b);
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }

  function getContrastRatio(lighter, darker) {
    return (lighter + 0.05) / (darker + 0.05);
  }

  function randomRgbColor() {
    return {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256)
    };
  }

  function rgbToHsl({ r, g, b }) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === red) {
        hue = ((green - blue) / delta) % 6;
      } else if (max === green) {
        hue = (blue - red) / delta + 2;
      } else {
        hue = (red - green) / delta + 4;
      }
    }

    const lightness = (max + min) / 2;
    const saturation = delta === 0
      ? 0
      : delta / (1 - Math.abs(2 * lightness - 1));

    return {
      h: ((hue * 60) + 360) % 360,
      s: saturation * 100,
      l: lightness * 100
    };
  }

  function hslToRgb({ h, s, l }) {
    const saturation = s / 100;
    const lightness = l / 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const hueSection = h / 60;
    const x = chroma * (1 - Math.abs((hueSection % 2) - 1));

    let red = 0;
    let green = 0;
    let blue = 0;

    if (hueSection >= 0 && hueSection < 1) {
      red = chroma; green = x; blue = 0;
    } else if (hueSection >= 1 && hueSection < 2) {
      red = x; green = chroma; blue = 0;
    } else if (hueSection >= 2 && hueSection < 3) {
      red = 0; green = chroma; blue = x;
    } else if (hueSection >= 3 && hueSection < 4) {
      red = 0; green = x; blue = chroma;
    } else if (hueSection >= 4 && hueSection < 5) {
      red = x; green = 0; blue = chroma;
    } else {
      red = chroma; green = 0; blue = x;
    }

    const match = lightness - chroma / 2;
    return {
      r: Math.round((red + match) * 255),
      g: Math.round((green + match) * 255),
      b: Math.round((blue + match) * 255)
    };
  }

  function getContrastFromRgb(colorA, colorB) {
    const lumA = getRelativeLuminance(colorA);
    const lumB = getRelativeLuminance(colorB);
    return getContrastRatio(Math.max(lumA, lumB), Math.min(lumA, lumB));
  }

  function pickLogoColorForBackground(background) {
    const backgroundHsl = rgbToHsl(background);
    const isBgLight = getRelativeLuminance(background) > 0.45;
    const hueOffsets = [30, 60, 90, 120, 150, 180, 210, 240, 300, 330];
    const saturationOptions = [95, 100];
    const lightnessOptions = isBgLight
      ? [22, 28, 34, 40, 46]
      : [56, 62, 68, 74];

    const candidates = [];
    for (const offset of hueOffsets) {
      for (const saturation of saturationOptions) {
        for (const lightness of lightnessOptions) {
          const hue = (backgroundHsl.h + offset + Math.random() * 24 - 12 + 360) % 360;
          const candidateHsl = { h: hue, s: saturation, l: lightness };
          const candidateRgb = hslToRgb(candidateHsl);
          candidates.push({
            css: `hsl(${Math.round(candidateHsl.h)} ${candidateHsl.s}% ${candidateHsl.l}%)`,
            contrast: getContrastFromRgb(background, candidateRgb),
            vividness: candidateHsl.s * (100 - Math.abs(candidateHsl.l - 50))
          });
        }
      }
    }

    candidates.sort((a, b) => {
      if (b.contrast !== a.contrast) {
        return b.contrast - a.contrast;
      }
      return b.vividness - a.vividness;
    });

    const strongVividMatches = candidates.filter((entry) => entry.contrast >= 3.5);
    if (strongVividMatches.length > 0) {
      return strongVividMatches[Math.floor(Math.random() * strongVividMatches.length)].css;
    }

    const fallbackVividMatches = candidates.filter((entry) => entry.contrast >= 3);
    if (fallbackVividMatches.length > 0) {
      return fallbackVividMatches[Math.floor(Math.random() * fallbackVividMatches.length)].css;
    }

    return getContrastFromRgb(background, { r: 255, g: 255, b: 255 }) >= 4.5
      ? '#ffffff'
      : '#000000';
  }

  function applyAccessibleRandomBackground() {
    const background = randomRgbColor();
    const bgLuminance = getRelativeLuminance(background);

    const blackLuminance = 0;
    const whiteLuminance = 1;
    const contrastWithBlack = getContrastRatio(
      Math.max(bgLuminance, blackLuminance),
      Math.min(bgLuminance, blackLuminance)
    );
    const contrastWithWhite = getContrastRatio(
      Math.max(bgLuminance, whiteLuminance),
      Math.min(bgLuminance, whiteLuminance)
    );

    const textColor = contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
    const bgCss = `rgb(${background.r} ${background.g} ${background.b})`;

    document.documentElement.style.setProperty('--page-bg', bgCss);
    document.documentElement.style.setProperty('--page-text', textColor);
    document.documentElement.style.setProperty('--logo-color', pickLogoColorForBackground(background));
  }

  async function sha256Hex(value) {
    const encoded = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  window.FroellerApp = {
    applyAccessibleRandomBackground,
    sha256Hex,
    PASSWORD_HASH: '7dce034e548b1e319664a6f0d28c30d61f3c5fb9765b76aa8c73bd5e391302fc',
    BOARD_KEY: 'froeller_board'
  };
})();
