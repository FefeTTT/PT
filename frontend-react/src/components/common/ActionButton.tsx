import styles from './ActionButton.module.css';

interface ActionButtonProps {
    textLabel: string;
    onButtonClicked: () => void;
    style?: React.CSSProperties;
}

export default function ActionButton({ textLabel, onButtonClicked, style }: ActionButtonProps) {
    return (
        <button className={`btn btn-primary btn-sm ${styles.actionButton}`} onClick={onButtonClicked} style={style}>
            {textLabel}
        </button>
    );
}

