<?php
class ReactLoader {
    private $manifestPath;
    private $publicPath;

    public function __construct($manifestPath, $publicPath) {
        $this->manifestPath = $manifestPath;
        $this->publicPath = $publicPath;
    }

    public function getAssets($entryName = 'src/main.tsx') {
        if (!file_exists($this->manifestPath)) {
            return "<!-- Manifest not found at {$this->manifestPath} -->";
        }
        $manifest = json_decode(file_get_contents($this->manifestPath), true);
        if (!isset($manifest[$entryName])) {
            return "<!-- Entry {$entryName} not found in manifest -->";
        }

        $entry = $manifest[$entryName];
        $output = "";

        // CSS
        if (isset($entry['css'])) {
            foreach ($entry['css'] as $cssFile) {
                $url = $this->publicPath . '/' . $cssFile;
                $output .= "<link rel='stylesheet' href='{$url}'>\n";
            }
        }

        // JS
        if (isset($entry['file'])) {
            $url = $this->publicPath . '/' . $entry['file'];
            $output .= "<script type='module' src='{$url}'></script>\n";
        }

        return $output;
    }
}
?>
