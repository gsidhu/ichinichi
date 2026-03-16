import { Button } from "../Button";
import { Modal } from "../Modal";
import { ModalCard } from "../ModalCard";
import type { AccessGateState } from "../../controllers/useAccessGate";
import styles from "./PasswordGate.module.css";

interface PasswordGateProps {
  state: AccessGateState;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onSubmit: () => void;
}

export function PasswordGate({
  state,
  onPasswordChange,
  onRememberMeChange,
  onSubmit,
}: PasswordGateProps) {
  const isChecking = state.phase === "checking";
  const isVerifying = state.phase === "verifying";

  return (
    <Modal isOpen onClose={() => {}} isDismissable={false} variant="overlay">
      <ModalCard maxWidth="sm">
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>Password required</h1>
            <p className={styles.description}>
              Enter your password to unlock Ichinichi.
            </p>
          </div>

          {isChecking ? (
            <p className={styles.loading}>Checking saved session…</p>
          ) : (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.label}>Password</span>
                <input
                  autoFocus
                  className={styles.input}
                  type="password"
                  name="password"
                  value={state.password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  disabled={isVerifying}
                />
              </label>

              <label className={styles.rememberRow}>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={state.rememberMe}
                  onChange={(event) => onRememberMeChange(event.target.checked)}
                  disabled={isVerifying}
                />
                <span>Remember me for 24 hours</span>
              </label>

              {state.error ? (
                <p className={styles.error} role="alert">
                  {state.error}
                </p>
              ) : null}

              <div className={styles.footer}>
                <Button type="submit" variant="primary" disabled={isVerifying}>
                  {isVerifying ? "Unlocking…" : "Unlock"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </ModalCard>
    </Modal>
  );
}
