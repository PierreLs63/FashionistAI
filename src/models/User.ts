import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IMensuration {
  valeur: number;
  unite: string;
  timestamp: Date;
}

export interface IUser extends Document {
  pseudo: string;
  email: string;
  password: string;
  mensurations: IMensuration[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const mensuationSchema = new Schema<IMensuration>({
  valeur: {
    type: Number,
    required: true
  },
  unite: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new Schema<IUser>({
  pseudo: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: 'Email invalide'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  mensurations: [mensuationSchema]
}, {
  timestamps: true
});

// Hash le mot de passe avant sauvegarde
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Ne pas retourner le mot de passe dans les réponses JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);
