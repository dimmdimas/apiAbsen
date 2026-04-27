import { Router, Request, Response } from "express";
import { User } from "../models/user.js";

const routerUser = Router();

routerUser.get('/:nik', async (req: Request, res: Response) => {
    try {
        const { nik } = req.params

        if (nik) {
            const user = await User.findOne({ nik: nik });
            if (!user) {
                return res.status(404).json({ message: 'User tidak ditemukan' });
            }
            res.json(user)
        }

        if (!nik) {
            return res.status(404).json({ message: 'NIK Null' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });

    }
}) 

export default routerUser;