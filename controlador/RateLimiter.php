<?php

class RateLimiter {
    private $filePath;
    private $maxAttempts = 5;
    private $timeWindowSeconds = 600; // 10 minutos

    public function __construct() {
        $this->filePath = __DIR__ . '/rate_limits.json';
    }

    public function check($ip) {
        $data = $this->loadData();
        $this->cleanup($data);

        if (isset($data[$ip])) {
            if ($data[$ip]['attempts'] >= $this->maxAttempts) {
                $firstAttemptTime = $data[$ip]['first_attempt'];
                if (time() - $firstAttemptTime < $this->timeWindowSeconds) {
                    return false;
                } else {
                    unset($data[$ip]);
                    $this->saveData($data);
                    return true;
                }
            }
        }
        return true;
    }

    public function recordFailure($ip) {
        $data = $this->loadData();
        
        if (!isset($data[$ip])) {
            $data[$ip] = [
                'attempts' => 1,
                'first_attempt' => time()
            ];
        } else {
            $data[$ip]['attempts']++;
            if (time() - $data[$ip]['first_attempt'] > $this->timeWindow) {
                 $data[$ip] = [
                    'attempts' => 1,
                    'first_attempt' => time()
                ];
            }
        }
        
        $this->saveData($data);
    }

    private function loadData() {
        if (!file_exists($this->filePath)) {
            return [];
        }
        $content = @file_get_contents($this->filePath);
        if (!$content) return [];
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function saveData($data) {
        @file_put_contents($this->filePath, json_encode($data));
    }

    private function cleanup(&$data) {
        $changed = false;
        foreach ($data as $ip => $info) {
             if (time() - $info['first_attempt'] > $this->timeWindow) {
                unset($data[$ip]);
                $changed = true;
             }
        }
        if ($changed) {
            $this->saveData($data);
        }
    }
}
?>
