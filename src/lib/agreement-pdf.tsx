import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, lineHeight: 1.4 },
  title: { fontSize: 16, marginBottom: 12, fontWeight: 700 },
  metaBlock: {
    marginBottom: 16,
    borderBottom: 1,
    borderColor: "#cccccc",
    paddingBottom: 12,
  },
  meta: { fontSize: 9, marginBottom: 3, color: "#444444" },
  paragraph: { marginBottom: 8 },
});

export interface SignedAgreementPdfProps {
  text: string;
  version: string;
  signerName: string;
  signedAt: Date;
  publicId: string;
  textHash: string;
}

function SignedAgreementDocument(props: SignedAgreementPdfProps) {
  const paragraphs = props.text.split("\n\n");
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Signed Rental Agreement</Text>
        <View style={styles.metaBlock}>
          <Text style={styles.meta}>Reservation: {props.publicId}</Text>
          <Text style={styles.meta}>Agreement version: {props.version}</Text>
          <Text style={styles.meta}>Signed by: {props.signerName}</Text>
          <Text style={styles.meta}>
            Signed at: {props.signedAt.toISOString()}
          </Text>
          <Text style={styles.meta}>Text hash (SHA-256): {props.textHash}</Text>
        </View>
        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </Page>
    </Document>
  );
}

export async function generateSignedAgreementPdf(
  props: SignedAgreementPdfProps
): Promise<Buffer> {
  return renderToBuffer(<SignedAgreementDocument {...props} />);
}
