<?php
class Respuesta {
    public static function make($isItOk, $error = null, $data = []) {
        $response = ['isItOk' => $isItOk];
        
        if ($error !== null) {
            $response['error'] = $error;
        }

        if (is_array($data) && !empty($data)) {
            $response = array_merge($response, $data);
        }
        return $response;
    }

    public static function json($isItOk, $error = null, $data = []) {
        $response = self::make($isItOk, $error, $data);
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
?>
